import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMode } from '../../generated/prisma/internal/prismaNamespace';
import { FileService } from '../file/file.service';
import { prompts } from '../../generated/prisma/client';
import { PageQuery } from '../models/user-api.io';

@Injectable()
export class PromptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FileService,
  ) {}

  async listPrompts({
    page = 1,
    pageSize = 20,
    search,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: QueryMode.insensitive } },
            { description: { contains: search, mode: QueryMode.insensitive } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.prompts.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.prompts.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async getPromptByPublicId(publicId: string): Promise<prompts | null> {
    return this.prisma.prompts.findFirst({
      where: {
        uuid: publicId,
      },
    });
  }

  async attachFilesToPrompts<T extends { id: bigint }>(
    items: T[],
  ): Promise<Map<bigint, any[]>> {
    const fileMap = new Map<bigint, any[]>();
    if (!items.length) return fileMap;

    const ids = items.map((i) => i.id);
    const files = await this.filesService.listFilesByRefIds('prompts', ids);

    files.forEach((file) => {
      if (!fileMap.has(file.ref_id)) fileMap.set(file.ref_id, []);
      fileMap.get(file.ref_id)?.push({
        file_type: file.file_type,
        position: file.position,
        url: file.url,
        created_at: file.created_at,
      });
    });

    fileMap.forEach((arr) => {
      arr.sort((a, b) => a.position - b.position);
    });
    return fileMap;
  }

  async getUserPromptStates(
    userId: bigint,
    promptIds: bigint[],
  ): Promise<Map<bigint, { is_favorite: boolean; purchased: boolean }>> {
    if (!userId || promptIds.length === 0) return new Map();

    const [favorites, purchases] = await this.prisma.$transaction([
      this.prisma.user_prompt_favorites.findMany({
        where: { user_id: userId, prompt_id: { in: promptIds } },
      }),
      this.prisma.user_prompts.findMany({
        where: { user_id: userId, prompt_id: { in: promptIds } },
      }),
    ]);

    const stateMap = new Map<
      bigint,
      { is_favorite: boolean; purchased: boolean }
    >();

    promptIds.forEach((id) => {
      stateMap.set(id, {
        is_favorite: favorites.some((f) => f.prompt_id === id),
        purchased: purchases.some((p) => p.prompt_id === id),
      });
    });

    return stateMap;
  }

  async attachUserStateToPrompts(
    userId: bigint | null,
    prompts: { id: bigint }[],
  ): Promise<Map<bigint, { is_favorite: boolean; purchased: boolean }>> {
    if (!userId || prompts.length === 0) return new Map();
    const promptIds = prompts.map((p) => p.id);
    return this.getUserPromptStates(userId, promptIds);
  }

  createPromptResponse(
    prompt: prompts,
    fileMap: Map<bigint, any[]>,
    stateMap: Map<bigint, { is_favorite: boolean; purchased: boolean }>,
  ) {
    const files = fileMap.get(prompt.id) || [];
    const userState = stateMap.get(prompt.id) || {
      is_favorite: false,
      purchased: false,
    };

    return {
      uuid: prompt.uuid,
      name: prompt.name,
      description: prompt.description,
      price: prompt.price,
      enabled: prompt.enabled,
      bonus_credit: prompt.bonus_credit,
      created_at: prompt.created_at,
      files,
      user_state: userState,
    };
  }

  async promptsToResponses(prompts: prompts[], userId: bigint | null = null) {
    if (!prompts.length) return [];

    const fileMap = await this.attachFilesToPrompts(prompts);
    const userStateMap = userId
      ? await this.attachUserStateToPrompts(userId, prompts)
      : new Map();

    return prompts.map((p) =>
      this.createPromptResponse(p, fileMap, userStateMap),
    );
  }

  async listFavoritePrompts(userId: bigint, options: PageQuery) {
    if (!userId) return { items: [], total: 0 };

    const [favorites, total] = await this.prisma.$transaction([
      this.prisma.user_prompt_favorites.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' },
        include: { prompts: true },
        skip: (options.page - 1) * options.page_size,
        take: options.page_size,
      }),
      this.prisma.user_prompt_favorites.count({
        where: { user_id: userId },
      }),
    ]);

    const prompts: prompts[] = favorites
      .map((f) => f.prompts)
      .filter((p): p is prompts => !!p);

    return { items: prompts, total };
  }

  async listPurchasedPrompts(userId: bigint, options: PageQuery) {
    const [purchased, total] = await this.prisma.$transaction([
      this.prisma.user_prompts.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: { prompts: true },
        skip: (options.page - 1) * options.page_size,
        take: options.page_size,
      }),
      this.prisma.user_prompts.count({ where: { user_id: userId } }),
    ]);

    const items = purchased
      .map((p) => p.prompts)
      .filter((p): p is prompts => !!p);

    return { items, total };
  }

  async addFavorite(userId: bigint, promptId: bigint): Promise<void> {
    await this.prisma.user_prompt_favorites.upsert({
      where: { user_id_prompt_id: { user_id: userId, prompt_id: promptId } },
      create: { user_id: userId, prompt_id: promptId },
      update: { updated_at: new Date() },
    });
  }

  async removeFavorite(userId: bigint, promptId: bigint): Promise<void> {
    const favorite = await this.prisma.user_prompt_favorites.findUnique({
      where: { user_id_prompt_id: { user_id: userId, prompt_id: promptId } },
    });

    if (!favorite) return;

    await this.prisma.user_prompt_favorites.delete({
      where: {
        user_id_prompt_id: { user_id: userId, prompt_id: promptId },
      },
    });
  }
}
