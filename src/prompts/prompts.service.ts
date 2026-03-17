import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMode } from '../../generated/prisma/internal/prismaNamespace';
import { FilesService } from '../files/files.service';
import { prompts } from '../../generated/prisma/client';

@Injectable()
export class PromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FilesService,
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
        public_id: publicId,
      },
    });
  }
}
