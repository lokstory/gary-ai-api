import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { files } from '../../generated/prisma/client';

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  async listFilesByRefIds(
    refTable: string,
    refIds: (number | bigint)[],
  ): Promise<files[]> {
    const files = await this.prisma.files.findMany({
      where: {
        ref_table: refTable,
        ref_id: {
          in: refIds as any,
        },
      },
    });
    return files;
  }

  async attachFiles<T extends { id: number | bigint }>(
    items: T[],
    refTable: string,
  ): Promise<(T & { files: any[] })[]> {
    if (!items.length) return [];

    const refIds = items.map((i) => i.id);
    const files = await this.listFilesByRefIds(refTable, refIds);

    const fileMap: Map<bigint | number, any[]> = new Map();
    files.forEach((file) => {
      if (!fileMap.has(file.ref_id)) {
        fileMap.set(file.ref_id, []);
      }
      fileMap.get(file.ref_id)?.push(file);
    });

    return items.map((item) => {
      const files = (fileMap.get(item.id) || []).sort(
        (a, b) => a.position - b.position,
      );
      return { ...item, files };
    });
  }
}
