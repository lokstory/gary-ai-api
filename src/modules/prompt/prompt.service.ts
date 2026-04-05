import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { FileService, UploadedBinaryFile } from '../file/file.service';
import { categories, files, prompts } from '../../../generated/prisma/client';
import { PageQuery, PromptFileResponse } from '../../models/user-api.io';
import { FileCategory, FileType, MediaType } from '../../models/enums';
import { isEnumEqual } from '../../utils/enum.util';
import {
  AdminCreatePromptRequest,
  AdminUpdatePromptRequest,
  CmsPromptDetailResponse,
  CmsPromptFileResponse,
  CmsPromptFilesResponse,
  CmsPromptResponse,
} from '../../models/admin-api.io';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { randomUUID } from 'crypto';

type PromptFileItem = {
  id: bigint;
  uuid: string;
  parent_id: bigint | null;
  category: string;
  file_type: string;
  position: number;
  url: string;
  thumbnail_url: string | null;
  created_at: Date | null;
};

type PromptAssetMutation = {
  id?: string | number | null;
  file_key?: string | null;
  thumbnail_id?: string | number | null;
  thumbnail_file_key?: string | null;
  position?: number;
};

type PromptDownloadMutation = {
  id?: string | number | null;
  file_key?: string | null;
};

type UpdatePromptFilesPayload = {
  cover?: PromptAssetMutation | null;
  pdf?: PromptDownloadMutation | null;
  media?: PromptAssetMutation[];
  delete_ids?: Array<string | number>;
};

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
    mediaType,
    categoryCode,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    mediaType?: MediaType;
    categoryCode?: string;
  }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: QueryMode.insensitive } },
              {
                description: {
                  contains: search,
                  mode: QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
      ...(mediaType
        ? {
            media_type: {
              equals: mediaType,
              mode: QueryMode.insensitive,
            },
          }
        : {}),
      ...(categoryCode
        ? {
            categories: {
              code: {
                equals: categoryCode,
                mode: QueryMode.insensitive,
              },
            },
          }
        : {}),
    };

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

  async getPromptById(id: number | bigint): Promise<prompts | null> {
    return this.prisma.prompts.findUnique({
      where: {
        id: BigInt(id),
      },
    });
  }

  async createPrompt(input: AdminCreatePromptRequest): Promise<prompts> {
    const categoryId = await this.ensureCategoryExists(input.category_id);

    return this.prisma.prompts.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        media_type: input.media_type ?? null,
        category_id: categoryId,
        price: input.price,
        bonus_credit: input.bonus_credit ?? 0,
        enabled: input.enabled ?? false,
      },
    });
  }

  async updatePromptById(
    id: number,
    input: AdminUpdatePromptRequest,
  ): Promise<prompts> {
    const existing = await this.getPromptById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const categoryId =
      input.category_id !== undefined
        ? await this.ensureCategoryExists(input.category_id)
        : undefined;

    return this.prisma.prompts.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.media_type !== undefined
          ? { media_type: input.media_type }
          : {}),
        ...(categoryId !== undefined ? { category_id: categoryId } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.bonus_credit !== undefined
          ? { bonus_credit: input.bonus_credit }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  toAdminResponse(prompt: prompts): CmsPromptResponse {
    return {
      id: prompt.id.toString(),
      uuid: prompt.uuid,
      name: prompt.name,
      description: prompt.description,
      media_type: (prompt.media_type as MediaType | null) ?? null,
      category: null,
      price: prompt.price,
      bonus_credit: prompt.bonus_credit,
      enabled: prompt.enabled,
      created_at: prompt.created_at ?? null,
      updated_at: prompt.updated_at ?? null,
    };
  }

  async toAdminResponseWithCategory(
    prompt: prompts,
  ): Promise<CmsPromptResponse> {
    const categoryMap = await this.attachCategoriesToPrompts([prompt]);
    return {
      ...this.toAdminResponse(prompt),
      category: categoryMap.get(prompt.id) ?? null,
    };
  }

  async updatePromptFiles(
    promptId: number,
    payloadRaw: string,
    uploadedFiles: Map<string, UploadedBinaryFile>,
  ): Promise<CmsPromptFilesResponse> {
    const prompt = await this.getPromptById(promptId);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const payload: UpdatePromptFilesPayload =
      this.parseUpdatePromptFilesPayload(payloadRaw);
    const existingFiles = await this.prisma.files.findMany({
      where: {
        ref_table: 'prompts',
        ref_id: prompt.id,
      },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    const existingFileMap = new Map(
      existingFiles.map((file) => [file.id, file]),
    );
    const deleteIdSet = this.expandDeleteIdSet(
      existingFiles,
      payload.delete_ids ?? [],
    );

    this.ensureDeleteIdsExist(existingFileMap, deleteIdSet);
    this.ensureDeleteIdsAreNotReferenced(payload, deleteIdSet);

    const cleanupMap = new Map<bigint, files>();

    await this.prisma.$transaction(async (tx) => {
      for (const file of this.getFilesToDelete(existingFiles, deleteIdSet)) {
        await tx.files.delete({ where: { id: file.id } });
        cleanupMap.set(file.id, file);
      }

      if (payload.cover) {
        await this.syncSingleFileCategory({
          tx,
          prompt,
          existingFiles,
          deleteIdSet,
          uploadedFiles,
          cleanupMap,
          category: FileCategory.COVER,
          mutation: payload.cover,
        });
      }

      if (payload.pdf) {
        await this.syncDownloadFile({
          tx,
          prompt,
          existingFiles,
          deleteIdSet,
          uploadedFiles,
          cleanupMap,
          mutation: payload.pdf ?? null,
        });
      }

      if (payload.media) {
        for (const [index, media] of payload.media.entries()) {
          await this.syncMediaFile({
            tx,
            prompt,
            existingFiles,
            uploadedFiles,
            cleanupMap,
            mutation: media,
            fallbackPosition: index,
          });
        }
      }
    });

    await Promise.allSettled(
      Array.from(cleanupMap.values()).map((file) =>
        this.filesService.deleteStoredFile(file),
      ),
    );

    return this.getAdminPromptFilesResponse(prompt.id);
  }

  async attachFilesToPrompts<T extends { id: bigint }>(
    items: T[],
  ): Promise<Map<bigint, PromptFileItem[]>> {
    const fileMap = new Map<bigint, PromptFileItem[]>();
    if (!items.length) return fileMap;

    const ids = items.map((i) => i.id);
    const files = await this.filesService.listFilesByRefIds('prompts', ids);
    const thumbnailByParentId = new Map<bigint, string>();

    files.forEach((file) => {
      if (
        isEnumEqual(FileCategory.THUMBNAIL, file.category) &&
        file.parent_id
      ) {
        if (!thumbnailByParentId.has(file.parent_id)) {
          thumbnailByParentId.set(
            file.parent_id,
            this.filesService.getFileUrl(file),
          );
        }
      }
    });

    files.forEach((file) => {
      if (!fileMap.has(file.ref_id)) fileMap.set(file.ref_id, []);
      fileMap.get(file.ref_id)?.push({
        id: file.id,
        uuid: file.uuid,
        parent_id: file.parent_id,
        category: file.category,
        file_type: file.file_type,
        position: file.position,
        url: this.filesService.getFileUrl(file),
        thumbnail_url: thumbnailByParentId.get(file.id) ?? null,
        created_at: file.created_at ?? null,
      });
    });

    fileMap.forEach((arr) => {
      arr.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.created_at && b.created_at
          ? a.created_at.getTime() - b.created_at.getTime()
          : 0;
      });
    });
    return fileMap;
  }

  async attachLabelsToPrompts<T extends { id: bigint }>(
    items: T[],
  ): Promise<Map<bigint, { code: string; name: string }[]>> {
    const labelMap = new Map<bigint, { code: string; name: string }[]>();
    if (!items.length) return labelMap;

    const promptIds = items.map((item) => item.id);
    const promptLabels = await this.prisma.prompt_labels.findMany({
      where: {
        prompt_id: {
          in: promptIds,
        },
      },
      include: {
        labels: true,
      },
      orderBy: [{ prompt_id: 'asc' }, { labels: { name: 'asc' } }],
    });

    promptLabels.forEach((promptLabel) => {
      if (!labelMap.has(promptLabel.prompt_id)) {
        labelMap.set(promptLabel.prompt_id, []);
      }

      labelMap.get(promptLabel.prompt_id)?.push({
        code: promptLabel.labels.code,
        name: promptLabel.labels.name,
      });
    });

    return labelMap;
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

  private toPromptFileResponse(file: PromptFileItem): PromptFileResponse {
    return {
      uuid: file.uuid,
      category: file.category,
      file_type: file.file_type,
      position: file.position,
      url: file.url,
      thumbnail_url: file.thumbnail_url,
      created_at: file.created_at,
    };
  }

  private toCmsPromptFileResponse(file: PromptFileItem): CmsPromptFileResponse {
    return {
      id: file.id.toString(),
      ...this.toPromptFileResponse(file),
    };
  }

  private toAdminPromptFilesResponse(
    files: PromptFileItem[],
  ): CmsPromptFilesResponse {
    const coverFile =
      files.find((file) => isEnumEqual(FileCategory.COVER, file.category)) ??
      null;
    const downloadFile =
      files.find((file) => isEnumEqual(FileCategory.DOWNLOAD, file.category)) ??
      null;
    const mediaFiles = files.filter((file) =>
      isEnumEqual(FileCategory.MEDIA, file.category),
    );

    return {
      cover: coverFile ? this.toCmsPromptFileResponse(coverFile) : null,
      pdf: downloadFile ? this.toCmsPromptFileResponse(downloadFile) : null,
      files: mediaFiles.map((file) => this.toCmsPromptFileResponse(file)),
    };
  }

  async getAdminPromptFilesResponse(
    promptId: bigint,
  ): Promise<CmsPromptFilesResponse> {
    const fileMap = await this.attachFilesToPrompts([{ id: promptId }]);
    return this.toAdminPromptFilesResponse(fileMap.get(promptId) || []);
  }

  async adminPromptToResponse(
    prompt: prompts,
  ): Promise<CmsPromptDetailResponse> {
    const fileMap = await this.attachFilesToPrompts([prompt]);
    const labelMap = await this.attachLabelsToPrompts([prompt]);
    const categoryMap = await this.attachCategoriesToPrompts([prompt]);
    const files = fileMap.get(prompt.id) || [];
    const labels = labelMap.get(prompt.id) || [];
    const category = categoryMap.get(prompt.id) ?? null;
    const assets = this.toAdminPromptFilesResponse(files);

    return {
      ...(await this.toAdminResponseWithCategory(prompt)),
      cover: assets.cover ?? null,
      pdf: assets.pdf ?? null,
      files: assets.files,
      labels,
    };
  }

  createPromptResponse(
    prompt: prompts,
    fileMap: Map<bigint, PromptFileItem[]>,
    labelMap: Map<bigint, { code: string; name: string }[]>,
    categoryMap: Map<bigint, { id: number; code: string; name: string } | null>,
    stateMap: Map<bigint, { is_favorite: boolean; purchased: boolean }>,
  ) {
    const files = fileMap.get(prompt.id) || [];
    const coverFile =
      files.find((file) => isEnumEqual(FileCategory.COVER, file.category)) ??
      null;
    const downloadFile =
      files.find((file) => isEnumEqual(FileCategory.DOWNLOAD, file.category)) ??
      null;
    const remainingFiles = files.filter((file) =>
      isEnumEqual(FileCategory.MEDIA, file.category),
    );
    const labels = labelMap.get(prompt.id) || [];
    const category = categoryMap.get(prompt.id) ?? null;
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
      media_type: (prompt.media_type as MediaType | null) ?? null,
      category,
      created_at: prompt.created_at,
      cover: coverFile ? this.toPromptFileResponse(coverFile) : null,
      pdf: downloadFile
        ? // userState.purchased && downloadFile
          this.toPromptFileResponse(downloadFile)
        : null,
      files: remainingFiles.map((file) => this.toPromptFileResponse(file)),
      labels,
      user_state: userState,
    };
  }

  async promptsToResponses(prompts: prompts[], userId: bigint | null = null) {
    if (!prompts.length) return [];

    const fileMap = await this.attachFilesToPrompts(prompts);
    const labelMap = await this.attachLabelsToPrompts(prompts);
    const categoryMap = await this.attachCategoriesToPrompts(prompts);
    const userStateMap = userId
      ? await this.attachUserStateToPrompts(userId, prompts)
      : new Map();

    return prompts.map((p) =>
      this.createPromptResponse(
        p,
        fileMap,
        labelMap,
        categoryMap,
        userStateMap,
      ),
    );
  }

  async attachCategoriesToPrompts<
    T extends { id: bigint; category_id?: number | null },
  >(
    items: T[],
  ): Promise<Map<bigint, { id: number; code: string; name: string } | null>> {
    const categoryMap = new Map<
      bigint,
      { id: number; code: string; name: string } | null
    >();
    if (!items.length) return categoryMap;

    const categoryIds = Array.from(
      new Set(
        items
          .map((item) => item.category_id)
          .filter(
            (item): item is number => item !== null && item !== undefined,
          ),
      ),
    );

    const categoriesById = new Map<number, categories>();
    if (categoryIds.length) {
      const categoryItems = await this.prisma.categories.findMany({
        where: { id: { in: categoryIds } },
      });

      categoryItems.forEach((category) => {
        categoriesById.set(category.id, category);
      });
    }

    items.forEach((item) => {
      if (!item.category_id) {
        categoryMap.set(item.id, null);
        return;
      }

      const category = categoriesById.get(item.category_id) ?? null;
      categoryMap.set(
        item.id,
        category
          ? {
              id: category.id,
              code: category.code,
              name: category.name,
            }
          : null,
      );
    });

    return categoryMap;
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

  private parseUpdatePromptFilesPayload(
    payloadRaw: string,
  ): UpdatePromptFilesPayload {
    try {
      const parsed = JSON.parse(payloadRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid payload');
      }

      return parsed as UpdatePromptFilesPayload;
    } catch {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'payload must be a valid JSON object',
      });
    }
  }

  private async ensureCategoryExists(categoryId?: number | null) {
    if (categoryId === undefined) {
      return undefined;
    }

    if (categoryId === null) {
      return null;
    }

    const category = await this.prisma.categories.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'category_id not found',
      });
    }

    return category.id;
  }

  private parsePositiveBigIntId(
    value: string | number | null | undefined,
    fieldName: string,
  ): bigint | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const normalizedValue =
      typeof value === 'number' ? value.toString() : value.trim();

    if (!/^\d+$/.test(normalizedValue)) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `${fieldName} must be a positive integer string`,
      });
    }

    const parsed = BigInt(normalizedValue);
    if (parsed <= 0n) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `${fieldName} must be a positive integer string`,
      });
    }

    return parsed;
  }

  private expandDeleteIdSet(
    existingFiles: files[],
    deleteIds: Array<string | number>,
  ) {
    const deleteIdSet = new Set<bigint>();
    deleteIds.forEach((id, index) => {
      const parsedId = this.parsePositiveBigIntId(id, `delete_ids[${index}]`);
      if (parsedId) {
        deleteIdSet.add(parsedId);
      }
    });

    existingFiles.forEach((file) => {
      if (file.parent_id && deleteIdSet.has(file.parent_id)) {
        deleteIdSet.add(file.id);
      }
    });
    return deleteIdSet;
  }

  private ensureDeleteIdsExist(
    existingFileMap: Map<bigint, files>,
    deleteIdSet: Set<bigint>,
  ) {
    for (const id of deleteIdSet) {
      if (!existingFileMap.has(id)) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `file id ${id.toString()} does not belong to this prompt`,
        });
      }
    }
  }

  private ensureDeleteIdsAreNotReferenced(
    payload: UpdatePromptFilesPayload,
    deleteIdSet: Set<bigint>,
  ) {
    const referencedIds: bigint[] = [];
    const coverId = this.parsePositiveBigIntId(payload.cover?.id, 'cover.id');
    if (coverId) referencedIds.push(coverId);
    const coverThumbnailId = this.parsePositiveBigIntId(
      payload.cover?.thumbnail_id,
      'cover.thumbnail_id',
    );
    if (coverThumbnailId) {
      referencedIds.push(coverThumbnailId);
    }
    const pdfId = this.parsePositiveBigIntId(payload.pdf?.id, 'pdf.id');
    if (pdfId) referencedIds.push(pdfId);
    payload.media?.forEach((item) => {
      const mediaId = this.parsePositiveBigIntId(item.id, 'media.id');
      if (mediaId) referencedIds.push(mediaId);
      const thumbnailId = this.parsePositiveBigIntId(
        item.thumbnail_id,
        'media.thumbnail_id',
      );
      if (thumbnailId) referencedIds.push(thumbnailId);
    });

    if (referencedIds.some((id) => deleteIdSet.has(id))) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'delete_ids cannot contain files referenced in payload',
      });
    }
  }

  private getFilesToDelete(existingFiles: files[], deleteIdSet: Set<bigint>) {
    return existingFiles
      .filter((file) => deleteIdSet.has(file.id))
      .sort((a, b) => Number(!!b.parent_id) - Number(!!a.parent_id));
  }

  private getExistingFileById(
    existingFiles: files[],
    id: string | number | null | undefined,
    expectedCategory?: FileCategory,
  ): files | null {
    const parsedId = this.parsePositiveBigIntId(id, 'id');
    if (!parsedId) return null;

    const file = existingFiles.find((item) => item.id === parsedId) ?? null;
    if (!file) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `file id ${id} not found`,
      });
    }

    if (expectedCategory && !isEnumEqual(expectedCategory, file.category)) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `file id ${id} category mismatch`,
      });
    }

    return file;
  }

  private findFirstExistingByCategory(
    existingFiles: files[],
    category: FileCategory,
    deleteIdSet: Set<bigint>,
  ): files | null {
    return (
      existingFiles.find(
        (file) =>
          isEnumEqual(category, file.category) && !deleteIdSet.has(file.id),
      ) ?? null
    );
  }

  private findFirstThumbnailByParentId(
    existingFiles: files[],
    parentId: bigint,
    deleteIdSet?: Set<bigint>,
  ): files | null {
    return (
      existingFiles.find(
        (file) =>
          file.parent_id === parentId &&
          isEnumEqual(FileCategory.THUMBNAIL, file.category) &&
          (!deleteIdSet || !deleteIdSet.has(file.id)),
      ) ?? null
    );
  }

  private async syncSingleFileCategory({
    tx,
    prompt,
    existingFiles,
    deleteIdSet,
    uploadedFiles,
    cleanupMap,
    category,
    mutation,
  }: {
    tx: any;
    prompt: prompts;
    existingFiles: files[];
    deleteIdSet: Set<bigint>;
    uploadedFiles: Map<string, UploadedBinaryFile>;
    cleanupMap: Map<bigint, files>;
    category: FileCategory.COVER;
    mutation: PromptAssetMutation | null | undefined;
  }) {
    const existingParent = this.findFirstExistingByCategory(
      existingFiles,
      category,
      deleteIdSet,
    );

    if (mutation === null) {
      return;
    }

    if (!mutation) return;

    const previousParent =
      this.getExistingFileById(existingFiles, mutation.id, category) ??
      existingParent;
    let parentFile = previousParent;

    if (mutation.file_key) {
      const uploaded = uploadedFiles.get(mutation.file_key);
      if (!uploaded) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `missing upload file for key ${mutation.file_key}`,
        });
      }

      const uploadedInfo = await this.uploadPromptAssetFile({
        promptUuid: prompt.uuid,
        category,
        file: uploaded,
        fileUuid: randomUUID(),
      });

      parentFile = await tx.files.create({
        data: {
          uuid: uploadedInfo.uuid,
          ref_table: 'prompts',
          ref_id: prompt.id,
          category,
          file_type: uploadedInfo.fileType,
          parent_id: null,
          position: 0,
          bucket: uploadedInfo.bucket,
          url: uploadedInfo.key,
          metadata: null,
        },
      });
    } else if (!parentFile) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `${category.toLowerCase()} requires id or file_key`,
      });
    }

    if (!parentFile) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const existingThumbnailForPreviousParent =
      previousParent &&
      this.findFirstThumbnailByParentId(
        existingFiles,
        previousParent.id,
        deleteIdSet,
      );

    await this.syncThumbnailForParent({
      tx,
      prompt,
      existingFiles,
      uploadedFiles,
      cleanupMap,
      parentFile,
      thumbnailId: Object.prototype.hasOwnProperty.call(
        mutation,
        'thumbnail_id',
      )
        ? (mutation.thumbnail_id ?? null)
        : undefined,
      thumbnailFileKey: Object.prototype.hasOwnProperty.call(
        mutation,
        'thumbnail_file_key',
      )
        ? (mutation.thumbnail_file_key ?? null)
        : undefined,
      previousParentFile: previousParent ?? undefined,
      existingThumbnailForPreviousParent:
        existingThumbnailForPreviousParent ?? undefined,
      deleteIdSet,
    });

    if (
      mutation.file_key &&
      previousParent &&
      previousParent.id !== parentFile.id
    ) {
      await tx.files.delete({ where: { id: previousParent.id } });
      cleanupMap.set(previousParent.id, previousParent);
    }
  }

  private async syncDownloadFile({
    tx,
    prompt,
    existingFiles,
    deleteIdSet,
    uploadedFiles,
    cleanupMap,
    mutation,
  }: {
    tx: any;
    prompt: prompts;
    existingFiles: files[];
    deleteIdSet: Set<bigint>;
    uploadedFiles: Map<string, UploadedBinaryFile>;
    cleanupMap: Map<bigint, files>;
    mutation: PromptDownloadMutation | null;
  }) {
    const existingDownload = this.findFirstExistingByCategory(
      existingFiles,
      FileCategory.DOWNLOAD,
      deleteIdSet,
    );

    if (mutation === null) {
      return;
    }

    if (!mutation) return;

    const previousDownload =
      this.getExistingFileById(
        existingFiles,
        mutation.id,
        FileCategory.DOWNLOAD,
      ) ?? existingDownload;
    let downloadFile = previousDownload;

    if (mutation.file_key) {
      const uploaded = uploadedFiles.get(mutation.file_key);
      if (!uploaded) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `missing upload file for key ${mutation.file_key}`,
        });
      }

      const uploadedInfo = await this.uploadPromptAssetFile({
        promptUuid: prompt.uuid,
        category: FileCategory.DOWNLOAD,
        file: uploaded,
        fileUuid: randomUUID(),
      });

      downloadFile = await tx.files.create({
        data: {
          uuid: uploadedInfo.uuid,
          ref_table: 'prompts',
          ref_id: prompt.id,
          category: FileCategory.DOWNLOAD,
          file_type: uploadedInfo.fileType,
          parent_id: null,
          position: 0,
          bucket: uploadedInfo.bucket,
          url: uploadedInfo.key,
          metadata: null,
        },
      });

      if (previousDownload) {
        await tx.files.delete({ where: { id: previousDownload.id } });
        cleanupMap.set(previousDownload.id, previousDownload);
      }
    } else if (!downloadFile) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'pdf requires id or file_key',
      });
    }
  }

  private async syncMediaFile({
    tx,
    prompt,
    existingFiles,
    uploadedFiles,
    cleanupMap,
    mutation,
    fallbackPosition,
  }: {
    tx: any;
    prompt: prompts;
    existingFiles: files[];
    uploadedFiles: Map<string, UploadedBinaryFile>;
    cleanupMap: Map<bigint, files>;
    mutation: PromptAssetMutation;
    fallbackPosition: number;
  }) {
    const previousMediaFile = this.getExistingFileById(
      existingFiles,
      mutation.id,
      FileCategory.MEDIA,
    );
    let mediaFile = previousMediaFile;
    const position = mutation.position ?? fallbackPosition;

    if (mutation.file_key) {
      const uploaded = uploadedFiles.get(mutation.file_key);
      if (!uploaded) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `missing upload file for key ${mutation.file_key}`,
        });
      }

      const uploadedInfo = await this.uploadPromptAssetFile({
        promptUuid: prompt.uuid,
        category: FileCategory.MEDIA,
        file: uploaded,
        fileUuid: randomUUID(),
      });

      mediaFile = await tx.files.create({
        data: {
          uuid: uploadedInfo.uuid,
          ref_table: 'prompts',
          ref_id: prompt.id,
          category: FileCategory.MEDIA,
          file_type: uploadedInfo.fileType,
          parent_id: null,
          position,
          bucket: uploadedInfo.bucket,
          url: uploadedInfo.key,
          metadata: null,
        },
      });
    } else if (mediaFile) {
      mediaFile = await tx.files.update({
        where: { id: mediaFile.id },
        data: { position },
      });
    } else {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'media item requires id or file_key',
      });
    }

    if (!mediaFile) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const existingThumbnailForPreviousParent =
      previousMediaFile &&
      this.findFirstThumbnailByParentId(existingFiles, previousMediaFile.id);

    await this.syncThumbnailForParent({
      tx,
      prompt,
      existingFiles,
      uploadedFiles,
      cleanupMap,
      parentFile: mediaFile,
      thumbnailId: Object.prototype.hasOwnProperty.call(
        mutation,
        'thumbnail_id',
      )
        ? (mutation.thumbnail_id ?? null)
        : undefined,
      thumbnailFileKey: Object.prototype.hasOwnProperty.call(
        mutation,
        'thumbnail_file_key',
      )
        ? (mutation.thumbnail_file_key ?? null)
        : undefined,
      previousParentFile: previousMediaFile ?? undefined,
      existingThumbnailForPreviousParent:
        existingThumbnailForPreviousParent ?? undefined,
    });

    if (
      mutation.file_key &&
      previousMediaFile &&
      previousMediaFile.id !== mediaFile.id
    ) {
      await tx.files.delete({ where: { id: previousMediaFile.id } });
      cleanupMap.set(previousMediaFile.id, previousMediaFile);
    }
  }

  private async syncThumbnailForParent({
    tx,
    prompt,
    existingFiles,
    uploadedFiles,
    cleanupMap,
    parentFile,
    thumbnailId,
    thumbnailFileKey,
    previousParentFile,
    existingThumbnailForPreviousParent,
    deleteIdSet,
  }: {
    tx: any;
    prompt: prompts;
    existingFiles: files[];
    uploadedFiles: Map<string, UploadedBinaryFile>;
    cleanupMap: Map<bigint, files>;
    parentFile: files;
    thumbnailId?: string | number | null;
    thumbnailFileKey?: string | null;
    previousParentFile?: files;
    existingThumbnailForPreviousParent?: files;
    deleteIdSet?: Set<bigint>;
  }) {
    const hasThumbnailMutation =
      thumbnailId !== undefined || thumbnailFileKey !== undefined;
    if (!hasThumbnailMutation) return;

    const existingThumbnail =
      this.getExistingFileById(
        existingFiles,
        thumbnailId ?? undefined,
        FileCategory.THUMBNAIL,
      ) ??
      existingThumbnailForPreviousParent ??
      this.findFirstThumbnailByParentId(
        existingFiles,
        parentFile.id,
        deleteIdSet,
      );

    if (!thumbnailFileKey) {
      if (
        previousParentFile &&
        previousParentFile.id !== parentFile.id &&
        existingThumbnail
      ) {
        await tx.files.update({
          where: { id: existingThumbnail.id },
          data: { parent_id: parentFile.id },
        });
      }
      return;
    }

    const uploaded = uploadedFiles.get(thumbnailFileKey);
    if (!uploaded) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `missing upload file for key ${thumbnailFileKey}`,
      });
    }

    const uploadedInfo = await this.uploadPromptAssetFile({
      promptUuid: prompt.uuid,
      category: FileCategory.THUMBNAIL,
      file: uploaded,
      fileUuid: randomUUID(),
    });

    if (existingThumbnail) {
      await tx.files.create({
        data: {
          uuid: uploadedInfo.uuid,
          ref_table: 'prompts',
          ref_id: prompt.id,
          category: FileCategory.THUMBNAIL,
          file_type: uploadedInfo.fileType,
          parent_id: parentFile.id,
          position: 0,
          bucket: uploadedInfo.bucket,
          url: uploadedInfo.key,
          metadata: null,
        },
      });
      await tx.files.delete({ where: { id: existingThumbnail.id } });
      cleanupMap.set(existingThumbnail.id, existingThumbnail);
      return;
    }

    await tx.files.create({
      data: {
        uuid: uploadedInfo.uuid,
        ref_table: 'prompts',
        ref_id: prompt.id,
        category: FileCategory.THUMBNAIL,
        file_type: uploadedInfo.fileType,
        parent_id: parentFile.id,
        position: 0,
        bucket: uploadedInfo.bucket,
        url: uploadedInfo.key,
        metadata: null,
      },
    });
  }

  private async uploadPromptAssetFile({
    promptUuid,
    category,
    file,
    fileUuid,
  }: {
    promptUuid: string;
    category: FileCategory;
    file: UploadedBinaryFile;
    fileUuid: string;
  }) {
    const fileType = this.detectFileType(file);
    this.validateFileTypeForCategory(category, fileType);

    const key = this.buildPromptFileKey({
      promptUuid,
      category,
      fileUuid,
      originalName: file.originalname,
    });

    const bucketType = isEnumEqual(FileCategory.DOWNLOAD, category)
      ? 'private'
      : 'public';
    const { bucket } = await this.filesService.uploadBinaryFile({
      file,
      bucketType,
      key,
    });

    return {
      uuid: fileUuid,
      key,
      bucket,
      fileType,
    };
  }

  private buildPromptFileKey({
    promptUuid,
    category,
    fileUuid,
    originalName,
  }: {
    promptUuid: string;
    category: FileCategory;
    fileUuid: string;
    originalName: string;
  }) {
    const extension = this.getFileExtension(originalName);
    const folder = isEnumEqual(FileCategory.COVER, category)
      ? 'cover'
      : isEnumEqual(FileCategory.MEDIA, category)
        ? 'media'
        : isEnumEqual(FileCategory.THUMBNAIL, category)
          ? 'thumbnails'
          : 'download';

    return `prompts/${promptUuid}/${folder}/${fileUuid}${extension}`;
  }

  private detectFileType(file: UploadedBinaryFile): FileType {
    if (file.mimetype.startsWith('image/')) {
      return FileType.IMAGE;
    }

    if (file.mimetype.startsWith('video/')) {
      return FileType.VIDEO;
    }

    if (file.mimetype === 'application/pdf') {
      return FileType.PDF;
    }

    const extension = this.getFileExtension(file.originalname).toLowerCase();
    if (extension === '.pdf') {
      return FileType.PDF;
    }

    throw new AppException({
      code: AppCode.PARAMETER_ERROR,
      message: `unsupported file type: ${file.originalname}`,
    });
  }

  private validateFileTypeForCategory(
    category: FileCategory,
    fileType: FileType,
  ) {
    if (
      isEnumEqual(FileCategory.COVER, category) ||
      isEnumEqual(FileCategory.MEDIA, category)
    ) {
      if (
        !isEnumEqual(FileType.IMAGE, fileType) &&
        !isEnumEqual(FileType.VIDEO, fileType)
      ) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `${category.toLowerCase()} only supports image or video`,
        });
      }
      return;
    }

    if (isEnumEqual(FileCategory.THUMBNAIL, category)) {
      if (!isEnumEqual(FileType.IMAGE, fileType)) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: 'thumbnail only supports image',
        });
      }
      return;
    }

    if (
      isEnumEqual(FileCategory.DOWNLOAD, category) &&
      !isEnumEqual(FileType.PDF, fileType)
    ) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'download only supports pdf',
      });
    }
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex < 0) return '';
    return filename.slice(lastDotIndex);
  }
}
