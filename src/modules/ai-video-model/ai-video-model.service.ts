import { Injectable } from '@nestjs/common';
import {
  ai_video_model_translations,
  ai_video_models,
} from '../../../generated/prisma/client';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import {
  AdminAiVideoModelDescriptionTranslationRequest,
  AdminUpdateAiVideoModelRequest,
  CmsAiVideoModelPositionItemRequest,
  CmsAiVideoModelResponse,
} from '../../models/admin-api.io';
import { PrismaService } from '../prisma/prisma.service';

type AiVideoModelWithTranslations = ai_video_models & {
  ai_video_model_translations: ai_video_model_translations[];
};

@Injectable()
export class AiVideoModelService {
  constructor(private readonly prisma: PrismaService) {}

  async listAiVideoModels({
    page = 1,
    pageSize = 20,
    search,
    provider,
    enabled,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    provider?: string;
    enabled?: boolean;
  }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(provider ? { provider } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(search
        ? {
            OR: [
              { provider: { contains: search, mode: QueryMode.insensitive } },
              { model: { contains: search, mode: QueryMode.insensitive } },
              { name: { contains: search, mode: QueryMode.insensitive } },
              {
                ai_video_model_translations: {
                  some: {
                    description: {
                      contains: search,
                      mode: QueryMode.insensitive,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ai_video_models.findMany({
        where,
        include: { ai_video_model_translations: true },
        skip,
        take: pageSize,
        orderBy: [
          { provider: 'asc' },
          { enabled: 'desc' },
          { position: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.prisma.ai_video_models.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async listEnabledAiVideoModels() {
    return this.prisma.ai_video_models.findMany({
      where: { enabled: true },
      include: { ai_video_model_translations: true },
      orderBy: [{ provider: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
  }

  async getAiVideoModelById(id: number) {
    return this.prisma.ai_video_models.findUnique({
      where: { id: BigInt(id) },
      include: { ai_video_model_translations: true },
    });
  }

  async updateAiVideoModel(id: number, input: AdminUpdateAiVideoModelRequest) {
    const existing = await this.getAiVideoModelById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    if (input.translations) {
      this.validateDescriptionTranslations(input.translations);
    }

    if (input.position !== undefined) {
      await this.ensurePositionIsAvailable(
        existing.provider,
        input.position,
        existing.id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ai_video_models.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
        },
      });

      if (input.translations) {
        await this.syncDescriptionTranslations(
          tx,
          existing.id,
          input.translations,
        );
      }

      return tx.ai_video_models.findUniqueOrThrow({
        where: { id: existing.id },
        include: { ai_video_model_translations: true },
      });
    });
  }

  async updateAiVideoModelPositions(
    items: CmsAiVideoModelPositionItemRequest[],
  ): Promise<AiVideoModelWithTranslations[]> {
    const normalizedItems = items ?? [];
    const uniqueIds = new Set<number>();

    normalizedItems.forEach((item, index) => {
      if (uniqueIds.has(item.id)) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `items[${index}].id duplicated`,
        });
      }

      uniqueIds.add(item.id);
    });

    const ids = normalizedItems.map((item) => BigInt(item.id));
    if (ids.length) {
      await this.validatePositionBatch(normalizedItems, ids);
    }

    await this.prisma.$transaction(
      normalizedItems.map((item) =>
        this.prisma.ai_video_models.update({
          where: { id: BigInt(item.id) },
          data: { position: item.position },
        }),
      ),
    );

    if (!ids.length) return [];

    return this.prisma.ai_video_models.findMany({
      where: { id: { in: ids } },
      include: { ai_video_model_translations: true },
      orderBy: [{ provider: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
  }

  toResponse(model: AiVideoModelWithTranslations): CmsAiVideoModelResponse {
    return {
      id: model.id.toString(),
      uuid: model.uuid,
      provider: model.provider,
      model: model.model,
      name: model.name,
      translations: model.ai_video_model_translations.map((translation) => ({
        locale: translation.locale,
        description: translation.description,
      })),
      enabled: model.enabled,
      position: model.position,
      created_at: model.created_at,
      updated_at: model.updated_at,
    };
  }

  private validateDescriptionTranslations(
    translations: AdminAiVideoModelDescriptionTranslationRequest[],
  ) {
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
  }

  private async validatePositionBatch(
    items: CmsAiVideoModelPositionItemRequest[],
    ids: bigint[],
  ) {
    const existingItems = await this.prisma.ai_video_models.findMany({
      where: { id: { in: ids } },
      select: { id: true, provider: true },
    });
    const existingIdSet = new Set(existingItems.map((item) => item.id));
    const missingId = ids.find((id) => !existingIdSet.has(id));

    if (missingId) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `AI video model id ${missingId.toString()} not found`,
      });
    }

    const affectedProviders = Array.from(
      new Set(existingItems.map((item) => item.provider)),
    );
    const modelsInAffectedProviders =
      await this.prisma.ai_video_models.findMany({
        where: { provider: { in: affectedProviders } },
        select: { id: true, provider: true, position: true },
      });
    const inputPositionById = new Map(
      items.map((item) => [BigInt(item.id).toString(), item.position]),
    );
    const finalPositionByProvider = new Map<string, Map<number, bigint>>();

    modelsInAffectedProviders.forEach((model) => {
      const finalPosition =
        inputPositionById.get(model.id.toString()) ?? model.position;
      const positionOwnerByProvider =
        finalPositionByProvider.get(model.provider) ??
        new Map<number, bigint>();
      const existingOwner = positionOwnerByProvider.get(finalPosition);

      if (existingOwner && existingOwner !== model.id) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `position ${finalPosition} duplicated in ${model.provider}`,
        });
      }

      positionOwnerByProvider.set(finalPosition, model.id);
      finalPositionByProvider.set(model.provider, positionOwnerByProvider);
    });
  }

  private async ensurePositionIsAvailable(
    provider: string,
    position: number,
    excludeId: bigint,
  ) {
    const existing = await this.prisma.ai_video_models.findFirst({
      where: {
        provider,
        position,
        id: { not: excludeId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `position ${position} duplicated in ${provider}`,
      });
    }
  }

  private async syncDescriptionTranslations(
    tx: any,
    videoModelId: bigint,
    translations: AdminAiVideoModelDescriptionTranslationRequest[],
  ) {
    const locales = translations.map((translation) => translation.locale);

    for (const translation of translations) {
      await tx.ai_video_model_translations.upsert({
        where: {
          video_model_id_locale: {
            video_model_id: videoModelId,
            locale: translation.locale,
          },
        },
        create: {
          video_model_id: videoModelId,
          locale: translation.locale,
          description: translation.description ?? null,
        },
        update: {
          description: translation.description ?? null,
        },
      });
    }

    await tx.ai_video_model_translations.deleteMany({
      where: {
        video_model_id: videoModelId,
        locale: { notIn: locales },
      },
    });
  }
}
