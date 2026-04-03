import { Injectable } from '@nestjs/common';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  AdminLabelResponse,
  AdminCreateLabelRequest,
  AdminUpdateLabelRequest,
} from '../../models/admin-api.io';

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
            { name: { contains: search, mode: QueryMode.insensitive } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.labels.findMany({
        where,
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
    });
  }

  async createLabel(input: AdminCreateLabelRequest) {
    await this.ensureLabelIsUnique(input.code, input.name);

    return this.prisma.labels.create({
      data: {
        code: input.code,
        name: input.name,
        enabled: input.enabled ?? true,
      },
    });
  }

  async updateLabel(id: number, input: AdminUpdateLabelRequest) {
    const existing = await this.getLabelById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const nextCode = input.code ?? existing.code;
    const nextName = input.name ?? existing.name;
    await this.ensureLabelIsUnique(nextCode, nextName, id);

    return this.prisma.labels.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
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

  toResponse(label: {
    id: number;
    code: string;
    name: string;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
  }): AdminLabelResponse {
    return {
      id: label.id,
      code: label.code,
      name: label.name,
      enabled: label.enabled,
      created_at: label.created_at,
      updated_at: label.updated_at,
    };
  }

  private async ensureLabelIsUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const existing = await this.prisma.labels.findFirst({
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
            ? 'Label code already exists'
            : 'Label name already exists',
      });
    }
  }
}
