import { Injectable } from '@nestjs/common';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  AdminCategoryResponse,
  AdminCreateCategoryRequest,
  AdminNameTranslationRequest,
  AdminUpdateCategoryRequest,
} from '../../models/admin-api.io';
import { category_translations } from '../../../generated/prisma/client';
import { PublicNamedItemResponse } from '../../models/user-api.io';

type CategoryWithTranslations = {
  id: number;
  code: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  category_translations: category_translations[];
};

const DEFAULT_LOCALE = 'en';

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
            {
              category_translations: {
                some: {
                  name: { contains: search, mode: QueryMode.insensitive },
                },
              },
            },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.categories.findMany({
        where,
        include: { category_translations: true },
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
      include: { category_translations: true },
    });
  }

  async listEnabledCategories() {
    return this.prisma.categories.findMany({
      where: { enabled: true },
      include: { category_translations: true },
      orderBy: [{ created_at: 'desc' }],
    });
  }

  async listEnabledCategoriesForLocale(
    locale: string = DEFAULT_LOCALE,
  ): Promise<PublicNamedItemResponse[]> {
    const categories = await this.listEnabledCategories();

    return categories.map((category) => ({
      code: category.code,
      name: this.resolveNameTranslation(category.category_translations, locale),
    }));
  }

  async createCategory(input: AdminCreateCategoryRequest) {
    this.validateNameTranslations(input.translations, true);
    await this.ensureCategoryCodeIsUnique(input.code);

    return this.prisma.categories.create({
      data: {
        code: input.code,
        enabled: input.enabled ?? true,
        category_translations: {
          create: input.translations.map((translation) => ({
            locale: translation.locale,
            name: translation.name,
          })),
        },
      },
      include: { category_translations: true },
    });
  }

  async updateCategory(id: number, input: AdminUpdateCategoryRequest) {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    if (input.code !== undefined) {
      await this.ensureCategoryCodeIsUnique(input.code, id);
    }
    if (input.translations) {
      this.validateNameTranslations(input.translations, true);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.categories.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      });

      if (input.translations) {
        await tx.category_translations.deleteMany({
          where: { category_id: id },
        });

        await tx.category_translations.createMany({
          data: input.translations.map((translation) => ({
            category_id: id,
            locale: translation.locale,
            name: translation.name,
          })),
        });
      }

      return tx.categories.findUniqueOrThrow({
        where: { id },
        include: { category_translations: true },
      });
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

  toResponse(category: CategoryWithTranslations): AdminCategoryResponse {
    return {
      id: category.id,
      code: category.code,
      translations: category.category_translations.map((translation) => ({
        locale: translation.locale,
        name: translation.name,
      })),
      enabled: category.enabled,
      created_at: category.created_at,
      updated_at: category.updated_at,
    };
  }

  private validateNameTranslations(
    translations: AdminNameTranslationRequest[],
    requireDefaultLocale: boolean,
  ) {
    if (!translations?.length) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'translations is required',
      });
    }

    const localeSet = new Set<string>();
    translations.forEach((translation, index) => {
      const locale = translation.locale.trim();
      if (!locale) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `translations[${index}].locale is required`,
        });
      }

      if (localeSet.has(locale)) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `translations[${index}].locale duplicated`,
        });
      }

      localeSet.add(locale);
    });

    if (requireDefaultLocale && !localeSet.has('en')) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'translations must include en',
      });
    }
  }

  private resolveNameTranslation(
    translations: category_translations[],
    locale: string,
  ) {
    return (
      translations.find((translation) => translation.locale === locale)?.name ??
      translations.find((translation) => translation.locale === DEFAULT_LOCALE)
        ?.name ??
      translations[0]?.name ??
      ''
    );
  }

  private async ensureCategoryCodeIsUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.categories.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'Category code already exists',
      });
    }
  }
}
