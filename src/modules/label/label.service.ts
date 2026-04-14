import { Injectable } from '@nestjs/common';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  AdminCreateLabelRequest,
  AdminLabelResponse,
  AdminNameTranslationRequest,
  AdminUpdateLabelRequest,
} from '../../models/admin-api.io';
import { label_translations } from '../../../generated/prisma/client';
import { PublicNamedItemResponse } from '../../models/user-api.io';

type LabelWithTranslations = {
  id: number;
  code: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  label_translations: label_translations[];
};

const DEFAULT_LOCALE = 'en';

@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  async listLabels({
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
              label_translations: {
                some: {
                  name: { contains: search, mode: QueryMode.insensitive },
                },
              },
            },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.labels.findMany({
        where,
        include: { label_translations: true },
        skip,
        take: pageSize,
        orderBy: [{ enabled: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.labels.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getLabelById(id: number) {
    return this.prisma.labels.findUnique({
      where: { id },
      include: { label_translations: true },
    });
  }

  async listEnabledLabels() {
    return this.prisma.labels.findMany({
      where: { enabled: true },
      include: { label_translations: true },
      orderBy: [{ created_at: 'desc' }],
    });
  }

  async listEnabledLabelsForLocale(
    locale: string = DEFAULT_LOCALE,
  ): Promise<PublicNamedItemResponse[]> {
    const labels = await this.listEnabledLabels();

    return labels.map((label) => ({
      code: label.code,
      name: this.resolveNameTranslation(label.label_translations, locale),
    }));
  }

  async createLabel(input: AdminCreateLabelRequest) {
    this.validateNameTranslations(input.translations, true);
    await this.ensureLabelCodeIsUnique(input.code);

    return this.prisma.labels.create({
      data: {
        code: input.code,
        enabled: input.enabled ?? true,
        label_translations: {
          create: input.translations.map((translation) => ({
            locale: translation.locale,
            name: translation.name,
          })),
        },
      },
      include: { label_translations: true },
    });
  }

  async updateLabel(id: number, input: AdminUpdateLabelRequest) {
    const existing = await this.getLabelById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    if (input.code !== undefined) {
      await this.ensureLabelCodeIsUnique(input.code, id);
    }
    if (input.translations) {
      this.validateNameTranslations(input.translations, true);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.labels.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      });

      if (input.translations) {
        await tx.label_translations.deleteMany({
          where: { label_id: id },
        });

        await tx.label_translations.createMany({
          data: input.translations.map((translation) => ({
            label_id: id,
            locale: translation.locale,
            name: translation.name,
          })),
        });
      }

      return tx.labels.findUniqueOrThrow({
        where: { id },
        include: { label_translations: true },
      });
    });
  }

  async deleteLabel(id: number) {
    const existing = await this.getLabelById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.prisma.labels.delete({
      where: { id },
    });
  }

  toResponse(label: LabelWithTranslations): AdminLabelResponse {
    return {
      id: label.id,
      code: label.code,
      translations: label.label_translations.map((translation) => ({
        locale: translation.locale,
        name: translation.name,
      })),
      enabled: label.enabled,
      created_at: label.created_at,
      updated_at: label.updated_at,
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
    translations: label_translations[],
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

  private async ensureLabelCodeIsUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.labels.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'Label code already exists',
      });
    }
  }
}
