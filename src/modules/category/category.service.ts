import { Injectable } from '@nestjs/common';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  AdminCategoryResponse,
  AdminCreateCategoryRequest,
  AdminUpdateCategoryRequest,
} from '../../models/admin-api.io';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories({
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
            { code: { contains: search, mode: QueryMode.insensitive } },
            { name: { contains: search, mode: QueryMode.insensitive } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.categories.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ enabled: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.categories.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getCategoryById(id: number) {
    return this.prisma.categories.findUnique({
      where: { id },
    });
  }

  async createCategory(input: AdminCreateCategoryRequest) {
    await this.ensureCategoryIsUnique(input.code, input.name);

    return this.prisma.categories.create({
      data: {
        code: input.code,
        name: input.name,
        enabled: input.enabled ?? true,
      },
    });
  }

  async updateCategory(id: number, input: AdminUpdateCategoryRequest) {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const nextCode = input.code ?? existing.code;
    const nextName = input.name ?? existing.name;
    await this.ensureCategoryIsUnique(nextCode, nextName, id);

    return this.prisma.categories.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  async deleteCategory(id: number) {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.prisma.categories.delete({
      where: { id },
    });
  }

  toResponse(category: {
    id: number;
    code: string;
    name: string;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
  }): AdminCategoryResponse {
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      enabled: category.enabled,
      created_at: category.created_at,
      updated_at: category.updated_at,
    };
  }

  private async ensureCategoryIsUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const existing = await this.prisma.categories.findFirst({
      where: {
        OR: [{ code }, { name }],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message:
          existing.code === code
            ? 'Category code already exists'
            : 'Category name already exists',
      });
    }
  }
}
