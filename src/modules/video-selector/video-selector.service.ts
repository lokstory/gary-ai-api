import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  files,
  video_selector_translations,
  video_selector_types,
  video_selectors,
} from '../../../generated/prisma/client';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import {
  AdminCreateVideoSelectorRequest,
  AdminNameTranslationRequest,
  AdminUpdateVideoSelectorRequest,
  CmsPromptFileResponse,
  CmsVideoSelectorPositionItemRequest,
  CmsVideoSelectorResponse,
  CmsVideoSelectorThumbnailResponse,
  CmsVideoSelectorTypeThumbnailResponse,
} from '../../models/admin-api.io';
import {
  PromptFileResponse,
  VideoSelectorResponse,
} from '../../models/user-api.io';
import { FileCategory, FileType, VideoSelectorType } from '../../models/enums';
import { isEnumEqual } from '../../utils/enum.util';
import { FileService, UploadedBinaryFile } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';

type SelectorWithTranslations = video_selectors & {
  video_selector_translations: video_selector_translations[];
};

type SelectorTypeWithFiles = video_selector_types & {
  files?: files[];
};

type VideoSelectorFilesResult = {
  cover: CmsPromptFileResponse | null;
};

@Injectable()
export class VideoSelectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FileService,
  ) {}

  async listVideoSelectors({
    page = 1,
    pageSize = 20,
    search,
    selectorType,
    enabled,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    selectorType?: string;
    enabled?: boolean;
  }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(selectorType ? { selector_type: selectorType } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: QueryMode.insensitive } },
              { prompt: { contains: search, mode: QueryMode.insensitive } },
              {
                video_selector_translations: {
                  some: {
                    name: { contains: search, mode: QueryMode.insensitive },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.video_selectors.findMany({
        where,
        include: { video_selector_translations: true },
        skip,
        take: pageSize,
        orderBy: [
          { selector_type: 'asc' },
          { enabled: 'desc' },
          { position: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.prisma.video_selectors.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getVideoSelectorById(id: number) {
    return this.prisma.video_selectors.findUnique({
      where: { id: BigInt(id) },
      include: { video_selector_translations: true },
    });
  }

  async listPublicVideoSelectors({
    selectorType,
  }: {
    selectorType?: string;
  } = {}) {
    return this.prisma.video_selectors.findMany({
      where: {
        enabled: true,
        ...(selectorType ? { selector_type: selectorType } : {}),
      },
      include: { video_selector_translations: true },
      orderBy: [{ selector_type: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
  }

  async createVideoSelector(
    input: AdminCreateVideoSelectorRequest,
    coverFile?: UploadedBinaryFile,
    thumbnailFile?: UploadedBinaryFile,
  ) {
    this.validateNameTranslations(input.translations, true);
    await this.ensureCodeIsUnique(input.selector_type, input.code);
    this.validateCoverFiles(
      input.selector_type,
      coverFile,
      thumbnailFile,
      true,
    );
    const cleanupMap = new Map<bigint, files>();

    const created = await this.prisma.$transaction(async (tx) => {
      const position =
        input.position ?? (await this.getNextPosition(tx, input.selector_type));
      await this.ensurePositionIsAvailable(tx, input.selector_type, position);

      const created = await tx.video_selectors.create({
        data: {
          selector_type: input.selector_type,
          code: input.code,
          prompt: input.prompt,
          enabled: input.enabled ?? true,
          position,
        },
      });

      await this.syncTranslations(tx, created.id, input.translations);
      await this.syncSelectorCoverFiles({
        tx,
        selector: created,
        existingFiles: [],
        cleanupMap,
        coverFile,
        thumbnailFile,
      });

      return tx.video_selectors.findUniqueOrThrow({
        where: { id: created.id },
        include: { video_selector_translations: true },
      });
    });

    await this.cleanupStoredFiles(cleanupMap);
    return created;
  }

  async updateVideoSelector(
    id: number,
    input: AdminUpdateVideoSelectorRequest,
    coverFile?: UploadedBinaryFile,
    thumbnailFile?: UploadedBinaryFile,
  ) {
    const existing = await this.getVideoSelectorById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const nextType = input.selector_type ?? existing.selector_type;
    const nextCode = input.code ?? existing.code;
    const selectorTypeChanged = input.selector_type !== undefined;
    const positionChanged = input.position !== undefined;
    if (input.selector_type !== undefined || input.code !== undefined) {
      await this.ensureCodeIsUnique(nextType, nextCode, id);
    }

    if (input.translations) {
      this.validateNameTranslations(input.translations, true);
    }

    this.validateCoverFiles(nextType, coverFile, thumbnailFile, false);
    const existingFiles = await this.filesService.listFilesByRefIds(
      'video_selectors',
      [existing.id],
    );
    const cleanupMap = new Map<bigint, files>();

    const updatedSelector = await this.prisma.$transaction(async (tx) => {
      const nextPosition =
        input.position ??
        (selectorTypeChanged
          ? await this.getNextPosition(tx, nextType, existing.id)
          : existing.position);

      if (selectorTypeChanged || positionChanged) {
        await this.ensurePositionIsAvailable(
          tx,
          nextType,
          nextPosition,
          existing.id,
        );
      }

      const updated = await tx.video_selectors.update({
        where: { id: BigInt(id) },
        data: {
          ...(input.selector_type !== undefined
            ? { selector_type: input.selector_type }
            : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(selectorTypeChanged || positionChanged
            ? { position: nextPosition }
            : {}),
        },
      });

      if (input.translations) {
        await this.syncTranslations(tx, BigInt(id), input.translations);
      }

      await this.syncSelectorCoverFiles({
        tx,
        selector: updated,
        existingFiles,
        cleanupMap,
        coverFile,
        thumbnailFile,
        removeThumbnailOnly:
          selectorTypeChanged &&
          !isEnumEqual(VideoSelectorType.STYLE, nextType) &&
          !coverFile,
      });

      const result = await tx.video_selectors.findUniqueOrThrow({
        where: { id: BigInt(id) },
        include: { video_selector_translations: true },
      });

      return result;
    });

    await this.cleanupStoredFiles(cleanupMap);
    return updatedSelector;
  }

  async deleteVideoSelector(id: number) {
    const existing = await this.getVideoSelectorById(id);
    if (!existing) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const existingFiles = await this.filesService.listFilesByRefIds(
      'video_selectors',
      [existing.id],
    );

    await this.prisma.video_selectors.delete({
      where: { id: existing.id },
    });

    await Promise.allSettled(
      existingFiles.map((file) => this.filesService.deleteStoredFile(file)),
    );
  }

  async updateVideoSelectorPositions(
    items: CmsVideoSelectorPositionItemRequest[],
  ): Promise<SelectorWithTranslations[]> {
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
      const existingItems = await this.prisma.video_selectors.findMany({
        where: { id: { in: ids } },
        select: { id: true, selector_type: true },
      });
      const existingIdSet = new Set(existingItems.map((item) => item.id));
      const missingId = ids.find((id) => !existingIdSet.has(id));

      if (missingId) {
        throw new AppException({
          code: AppCode.PARAMETER_ERROR,
          message: `video selector id ${missingId.toString()} not found`,
        });
      }

      const affectedTypes = Array.from(
        new Set(existingItems.map((item) => item.selector_type)),
      );
      const selectorsInAffectedTypes =
        await this.prisma.video_selectors.findMany({
          where: { selector_type: { in: affectedTypes } },
          select: { id: true, selector_type: true, position: true },
        });
      const inputPositionById = new Map(
        normalizedItems.map((item) => [
          BigInt(item.id).toString(),
          item.position,
        ]),
      );
      const finalPositionByType = new Map<string, Map<number, bigint>>();

      selectorsInAffectedTypes.forEach((selector) => {
        const finalPosition =
          inputPositionById.get(selector.id.toString()) ?? selector.position;
        const positionOwnerByType =
          finalPositionByType.get(selector.selector_type) ??
          new Map<number, bigint>();
        const existingOwner = positionOwnerByType.get(finalPosition);

        if (existingOwner && existingOwner !== selector.id) {
          throw new AppException({
            code: AppCode.PARAMETER_ERROR,
            message: `position ${finalPosition} duplicated in ${selector.selector_type}`,
          });
        }

        positionOwnerByType.set(finalPosition, selector.id);
        finalPositionByType.set(selector.selector_type, positionOwnerByType);
      });
    }

    await this.prisma.$transaction(
      normalizedItems.map((item) =>
        this.prisma.video_selectors.update({
          where: { id: BigInt(item.id) },
          data: { position: item.position },
        }),
      ),
    );

    if (!ids.length) return [];

    return this.prisma.video_selectors.findMany({
      where: { id: { in: ids } },
      include: { video_selector_translations: true },
      orderBy: [{ selector_type: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
  }

  private validateCoverFiles(
    selectorType: string,
    coverFile?: UploadedBinaryFile,
    thumbnailFile?: UploadedBinaryFile,
    requireCoverForThumbnail = false,
  ) {
    if (thumbnailFile && !isEnumEqual(VideoSelectorType.STYLE, selectorType)) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'thumbnail only supports STYLE selector',
      });
    }

    if (requireCoverForThumbnail && thumbnailFile && !coverFile) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'cover is required before thumbnail upload',
      });
    }
  }

  private async syncSelectorCoverFiles({
    tx,
    selector,
    existingFiles,
    cleanupMap,
    coverFile,
    thumbnailFile,
    removeThumbnailOnly = false,
  }: {
    tx: any;
    selector: video_selectors;
    existingFiles: files[];
    cleanupMap: Map<bigint, files>;
    coverFile?: UploadedBinaryFile;
    thumbnailFile?: UploadedBinaryFile;
    removeThumbnailOnly?: boolean;
  }) {
    const previousVideo = this.findFirstFileByCategory(
      existingFiles,
      FileCategory.COVER,
      new Set(),
    );
    let video = previousVideo;

    if (coverFile) {
      await this.deleteSelectorVideoFiles(tx, existingFiles, cleanupMap);
      video = await this.createSelectorVideo({
        tx,
        selector,
        file: coverFile,
      });
    }

    if (removeThumbnailOnly && video) {
      await this.deleteSelectorThumbnailFiles(
        tx,
        existingFiles,
        video.id,
        cleanupMap,
      );
    }

    if (!thumbnailFile) return;

    if (!video) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'cover is required before thumbnail upload',
      });
    }

    await this.deleteSelectorThumbnailFiles(
      tx,
      existingFiles,
      video.id,
      cleanupMap,
    );
    await this.createSelectorThumbnail({
      tx,
      selector,
      video,
      file: thumbnailFile,
    });
  }

  async getSelectorType(
    selectorType: VideoSelectorType,
  ): Promise<video_selector_types> {
    const type = await this.prisma.video_selector_types.upsert({
      where: { selector_type: selectorType },
      update: {},
      create: {
        selector_type: selectorType,
        has_global_thumbnail:
          selectorType === VideoSelectorType.MOVEMENT ||
          selectorType === VideoSelectorType.MOTION,
      },
    });

    this.ensureGlobalThumbnailSelectorType(type);
    return type;
  }

  async getTypeThumbnailResponse(
    selectorType: VideoSelectorType,
  ): Promise<CmsVideoSelectorTypeThumbnailResponse> {
    const setting = await this.getSelectorType(selectorType);
    const files = await this.filesService.listFilesByRefIds(
      'video_selector_types',
      [setting.id],
    );
    return this.toSelectorTypeThumbnailResponse({ ...setting, files });
  }

  async updateTypeThumbnail(
    selectorType: VideoSelectorType,
    file: UploadedBinaryFile,
  ): Promise<CmsVideoSelectorTypeThumbnailResponse> {
    const setting = await this.getSelectorType(selectorType);
    const existingFiles = await this.filesService.listFilesByRefIds(
      'video_selector_types',
      [setting.id],
    );
    const cleanupMap = new Map<bigint, files>();

    await this.prisma.$transaction(async (tx) => {
      await this.deleteTypeThumbnailFiles(tx, existingFiles, cleanupMap);
      await this.createTypeThumbnail({ tx, setting, file });
    });

    await Promise.allSettled(
      Array.from(cleanupMap.values()).map((file) =>
        this.filesService.deleteStoredFile(file),
      ),
    );

    return this.getTypeThumbnailResponse(selectorType);
  }

  async deleteTypeThumbnail(selectorType: VideoSelectorType): Promise<void> {
    const setting = await this.getSelectorType(selectorType);
    const existingFiles = await this.filesService.listFilesByRefIds(
      'video_selector_types',
      [setting.id],
    );
    const cleanupMap = new Map<bigint, files>();

    await this.prisma.$transaction(async (tx) => {
      await this.deleteTypeThumbnailFiles(tx, existingFiles, cleanupMap);
    });

    await Promise.allSettled(
      Array.from(cleanupMap.values()).map((file) =>
        this.filesService.deleteStoredFile(file),
      ),
    );
  }

  async toDetailResponse(selector: SelectorWithTranslations): Promise<
    CmsVideoSelectorResponse & {
      cover: CmsPromptFileResponse | null;
    }
  > {
    const globalThumbnail = await this.resolveGlobalThumbnail(selector);
    const files = await this.filesService.listFilesByRefIds('video_selectors', [
      selector.id,
    ]);
    const filesResponse = this.toFilesResponse(files, globalThumbnail);

    return {
      ...this.toResponse(selector),
      cover: filesResponse.cover ?? null,
    };
  }

  async toResponseWithCover(
    selector: SelectorWithTranslations,
  ): Promise<CmsVideoSelectorResponse> {
    const globalThumbnail = await this.resolveGlobalThumbnail(selector);
    const files = await this.filesService.listFilesByRefIds('video_selectors', [
      selector.id,
    ]);
    const filesResponse = this.toFilesResponse(files, globalThumbnail);

    return {
      ...this.toResponse(selector),
      cover: filesResponse.cover,
    };
  }

  toResponse(selector: SelectorWithTranslations): CmsVideoSelectorResponse {
    return {
      id: selector.id.toString(),
      uuid: selector.uuid,
      selector_type: selector.selector_type,
      code: selector.code,
      prompt: selector.prompt,
      translations: selector.video_selector_translations.map((translation) => ({
        locale: translation.locale,
        name: translation.name,
      })),
      enabled: selector.enabled,
      position: selector.position,
      created_at: selector.created_at,
      updated_at: selector.updated_at,
    };
  }

  async toPublicResponses(
    selectors: SelectorWithTranslations[],
    locale: string,
  ): Promise<VideoSelectorResponse[]> {
    return Promise.all(
      selectors.map((selector) => this.toPublicResponse(selector, locale)),
    );
  }

  private async toPublicResponse(
    selector: SelectorWithTranslations,
    locale: string,
  ): Promise<VideoSelectorResponse> {
    const globalThumbnail = await this.resolveGlobalThumbnail(selector);
    const files = await this.filesService.listFilesByRefIds('video_selectors', [
      selector.id,
    ]);
    const filesResponse = this.toFilesResponse(files, globalThumbnail);

    return {
      uuid: selector.uuid,
      selector_type: selector.selector_type,
      code: selector.code,
      name: this.resolveNameTranslation(
        selector.video_selector_translations,
        locale,
      ),
      prompt: selector.prompt,
      position: selector.position,
      cover: filesResponse.cover
        ? this.toPublicFileResponse(filesResponse.cover)
        : null,
    };
  }

  private async resolveGlobalThumbnail(selector: video_selectors) {
    if (isEnumEqual(VideoSelectorType.STYLE, selector.selector_type)) {
      return null;
    }

    const setting = await this.prisma.video_selector_types.findUnique({
      where: { selector_type: selector.selector_type },
    });
    if (!setting) return null;

    const files = await this.filesService.listFilesByRefIds(
      'video_selector_types',
      [setting.id],
    );
    const thumbnail = this.findFirstFileByCategory(
      files,
      FileCategory.THUMBNAIL,
      new Set(),
    );
    return thumbnail
      ? {
          id: thumbnail.id.toString(),
          url: this.filesService.getFileUrl(thumbnail),
        }
      : null;
  }

  private async createSelectorVideo({
    tx,
    selector,
    file,
  }: {
    tx: any;
    selector: video_selectors;
    file: UploadedBinaryFile;
  }): Promise<files> {
    const uploadedInfo = await this.uploadAssetFile({
      refUuid: selector.uuid,
      refFolder: 'video-selectors',
      category: FileCategory.COVER,
      file,
      fileUuid: randomUUID(),
      expectedFileType: FileType.VIDEO,
    });

    const created = (await tx.files.create({
      data: {
        uuid: uploadedInfo.uuid,
        ref_table: 'video_selectors',
        ref_id: selector.id,
        category: FileCategory.COVER,
        file_type: uploadedInfo.fileType,
        parent_id: null,
        position: 0,
        bucket: uploadedInfo.bucket,
        url: uploadedInfo.key,
        metadata: null,
      },
    })) as files;

    return created;
  }

  private async createSelectorThumbnail({
    tx,
    selector,
    video,
    file,
  }: {
    tx: any;
    selector: video_selectors;
    video: files;
    file: UploadedBinaryFile;
  }) {
    const uploadedInfo = await this.uploadAssetFile({
      refUuid: selector.uuid,
      refFolder: 'video-selectors',
      category: FileCategory.THUMBNAIL,
      file,
      fileUuid: randomUUID(),
      expectedFileType: FileType.IMAGE,
    });

    await tx.files.create({
      data: {
        uuid: uploadedInfo.uuid,
        ref_table: 'video_selectors',
        ref_id: selector.id,
        category: FileCategory.THUMBNAIL,
        file_type: uploadedInfo.fileType,
        parent_id: video.id,
        position: 0,
        bucket: uploadedInfo.bucket,
        url: uploadedInfo.key,
        metadata: null,
      },
    });
  }

  private async createTypeThumbnail({
    tx,
    setting,
    file,
  }: {
    tx: any;
    setting: video_selector_types;
    file: UploadedBinaryFile;
  }) {
    const uploadedInfo = await this.uploadAssetFile({
      refUuid: this.sanitizePathPart(setting.selector_type),
      refFolder: 'video-selector-types',
      category: FileCategory.THUMBNAIL,
      file,
      fileUuid: randomUUID(),
      expectedFileType: FileType.IMAGE,
    });

    await tx.files.create({
      data: {
        uuid: uploadedInfo.uuid,
        ref_table: 'video_selector_types',
        ref_id: setting.id,
        category: FileCategory.THUMBNAIL,
        file_type: uploadedInfo.fileType,
        parent_id: null,
        position: 0,
        bucket: uploadedInfo.bucket,
        url: uploadedInfo.key,
        metadata: null,
      },
    });
  }

  private async deleteTypeThumbnailFiles(
    tx: any,
    existingFiles: files[],
    cleanupMap: Map<bigint, files>,
  ) {
    for (const file of existingFiles) {
      if (isEnumEqual(FileCategory.THUMBNAIL, file.category)) {
        await tx.files.delete({ where: { id: file.id } });
        cleanupMap.set(file.id, file);
      }
    }
  }

  private async deleteSelectorVideoFiles(
    tx: any,
    existingFiles: files[],
    cleanupMap: Map<bigint, files>,
  ) {
    const filesToDelete = existingFiles
      .filter(
        (file) =>
          isEnumEqual(FileCategory.COVER, file.category) ||
          isEnumEqual(FileCategory.THUMBNAIL, file.category),
      )
      .sort((a, b) => Number(!!b.parent_id) - Number(!!a.parent_id));

    for (const file of filesToDelete) {
      await tx.files.delete({ where: { id: file.id } });
      cleanupMap.set(file.id, file);
    }
  }

  private async deleteSelectorThumbnailFiles(
    tx: any,
    existingFiles: files[],
    videoId: bigint,
    cleanupMap: Map<bigint, files>,
  ) {
    for (const file of existingFiles) {
      if (
        file.parent_id === videoId &&
        isEnumEqual(FileCategory.THUMBNAIL, file.category)
      ) {
        await tx.files.delete({ where: { id: file.id } });
        cleanupMap.set(file.id, file);
      }
    }
  }

  private async cleanupStoredFiles(cleanupMap: Map<bigint, files>) {
    await Promise.allSettled(
      Array.from(cleanupMap.values()).map((file) =>
        this.filesService.deleteStoredFile(file),
      ),
    );
  }

  private toFilesResponse(
    files: files[],
    globalThumbnail: { id: string; url: string } | null = null,
  ): VideoSelectorFilesResult {
    const thumbnailByParentId = new Map<bigint, string>();
    const thumbnailIdByParentId = new Map<bigint, string>();
    files.forEach((file) => {
      if (
        isEnumEqual(FileCategory.THUMBNAIL, file.category) &&
        file.parent_id
      ) {
        thumbnailIdByParentId.set(file.parent_id, file.id.toString());
        thumbnailByParentId.set(
          file.parent_id,
          this.filesService.getFileUrl(file),
        );
      }
    });

    const responseFiles = files
      .map((file) =>
        this.toFileResponse(file, thumbnailIdByParentId, thumbnailByParentId),
      )
      .map((file) =>
        globalThumbnail &&
        isEnumEqual(FileCategory.COVER, file.category) &&
        !file.thumbnail_url
          ? {
              ...file,
              thumbnail_id: globalThumbnail.id,
              thumbnail_url: globalThumbnail.url,
            }
          : file,
      )
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.id.localeCompare(b.id);
      });

    const cover =
      responseFiles.find((file) =>
        isEnumEqual(FileCategory.COVER, file.category),
      ) ?? null;

    return {
      cover,
    };
  }

  private toSelectorTypeThumbnailResponse(
    setting: SelectorTypeWithFiles,
  ): CmsVideoSelectorTypeThumbnailResponse {
    const files = setting.files ?? [];
    const thumbnail =
      files.find((file) =>
        isEnumEqual(FileCategory.THUMBNAIL, file.category),
      ) ?? null;

    return {
      id: setting.id.toString(),
      selector_type: setting.selector_type,
      has_global_thumbnail: setting.has_global_thumbnail,
      thumbnail: thumbnail ? this.toThumbnailResponse(thumbnail) : null,
      created_at: setting.created_at,
      updated_at: setting.updated_at,
    };
  }

  private toThumbnailResponse(file: files): CmsVideoSelectorThumbnailResponse {
    return {
      id: file.id.toString(),
      uuid: file.uuid,
      category: file.category,
      file_type: file.file_type,
      position: file.position,
      url: this.filesService.getFileUrl(file),
      created_at: file.created_at ?? null,
    };
  }

  private toFileResponse(
    file: files,
    thumbnailIdByParentId: Map<bigint, string> = new Map(),
    thumbnailByParentId: Map<bigint, string> = new Map(),
  ): CmsPromptFileResponse {
    return {
      id: file.id.toString(),
      uuid: file.uuid,
      category: file.category,
      file_type: file.file_type,
      position: file.position,
      url: this.filesService.getFileUrl(file),
      thumbnail_id: thumbnailIdByParentId.get(file.id) ?? null,
      thumbnail_url: thumbnailByParentId.get(file.id) ?? null,
      created_at: file.created_at ?? null,
    };
  }

  private toPublicFileResponse(
    file: CmsPromptFileResponse,
  ): PromptFileResponse {
    return {
      uuid: file.uuid,
      category: file.category,
      file_type: file.file_type,
      position: file.position,
      url: file.url,
      thumbnail_url: file.thumbnail_url ?? null,
      created_at: file.created_at ?? null,
    };
  }

  private async uploadAssetFile({
    refUuid,
    refFolder,
    category,
    file,
    fileUuid,
    expectedFileType,
  }: {
    refUuid: string;
    refFolder: string;
    category: FileCategory;
    file: UploadedBinaryFile;
    fileUuid: string;
    expectedFileType: FileType;
  }) {
    const fileType = this.detectFileType(file);
    if (!isEnumEqual(expectedFileType, fileType)) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `${category.toLowerCase()} file type mismatch`,
      });
    }

    const extension = this.getFileExtension(file.originalname);
    const folder = isEnumEqual(FileCategory.COVER, category)
      ? 'cover'
      : 'thumbnails';
    const key = `${refFolder}/${refUuid}/${folder}/${fileUuid}${extension}`;
    const { bucket } = await this.filesService.uploadBinaryFile({
      file,
      bucketType: 'public',
      key,
    });

    return {
      uuid: fileUuid,
      key,
      bucket,
      fileType,
    };
  }

  private detectFileType(file: UploadedBinaryFile): FileType {
    if (file.mimetype.startsWith('image/')) return FileType.IMAGE;
    if (file.mimetype.startsWith('video/')) return FileType.VIDEO;

    throw new AppException({
      code: AppCode.PARAMETER_ERROR,
      message: `unsupported file type: ${file.originalname}`,
    });
  }

  private findFirstFileByCategory(
    existingFiles: files[],
    category: FileCategory,
    deleteIdSet: Set<bigint>,
  ) {
    return (
      existingFiles.find(
        (file) =>
          isEnumEqual(category, file.category) && !deleteIdSet.has(file.id),
      ) ?? null
    );
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

  private async ensureCodeIsUnique(
    selectorType: string,
    code: string,
    excludeId?: number,
  ) {
    const existing = await this.prisma.video_selectors.findFirst({
      where: {
        selector_type: selectorType,
        code,
        ...(excludeId ? { id: { not: BigInt(excludeId) } } : {}),
      },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: 'Video selector code already exists',
      });
    }
  }

  private async getNextPosition(
    tx: any,
    selectorType: string,
    excludeId?: bigint,
  ): Promise<number> {
    const item = (await tx.video_selectors.findFirst({
      where: {
        selector_type: selectorType,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: [{ position: 'desc' }, { id: 'desc' }],
      select: { position: true },
    })) as { position: number } | null;

    return (item?.position ?? -1) + 1;
  }

  private async ensurePositionIsAvailable(
    tx: any,
    selectorType: string,
    position: number,
    excludeId?: bigint,
  ) {
    const existing = await tx.video_selectors.findFirst({
      where: {
        selector_type: selectorType,
        position,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `position ${position} duplicated in ${selectorType}`,
      });
    }
  }

  private async syncTranslations(
    tx: any,
    selectorId: bigint,
    translations: AdminNameTranslationRequest[],
  ) {
    const locales = translations.map((translation) => translation.locale);

    for (const translation of translations) {
      await tx.video_selector_translations.upsert({
        where: {
          video_selector_id_locale: {
            video_selector_id: selectorId,
            locale: translation.locale,
          },
        },
        create: {
          video_selector_id: selectorId,
          locale: translation.locale,
          name: translation.name,
        },
        update: {
          name: translation.name,
        },
      });
    }

    await tx.video_selector_translations.deleteMany({
      where: {
        video_selector_id: selectorId,
        locale: { notIn: locales },
      },
    });
  }

  private sanitizePathPart(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private ensureGlobalThumbnailSelectorType(
    selectorType: video_selector_types,
  ) {
    if (!selectorType.has_global_thumbnail) {
      throw new AppException({
        code: AppCode.PARAMETER_ERROR,
        message: `${selectorType.selector_type} does not support global thumbnail`,
      });
    }
  }

  private resolveNameTranslation(
    translations: video_selector_translations[],
    locale: string,
  ) {
    return (
      translations.find((translation) => translation.locale === locale)?.name ??
      translations.find((translation) => translation.locale === 'en')?.name ??
      translations[0]?.name ??
      ''
    );
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex < 0) return '';
    return filename.slice(lastDotIndex);
  }
}
