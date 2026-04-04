import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { files } from '../../../generated/prisma/client';
import { joinFileUrl } from '../../utils/file.util';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { s3Client } from '../../components/aws-s3.client';
import { Readable } from 'stream';

export type UploadedBinaryFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class FileService {
  private readonly publicBucket: string | undefined;
  private readonly publicUrlPrefix: string | undefined;
  private readonly privateBucket: string | undefined;
  private readonly privateUrlPrefix: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.publicBucket = this.config.get<string>('S3_BUCKET_PUBLIC');
    this.publicUrlPrefix = this.config.get<string>('S3_BUCKET_PUBLIC_URL');
    this.privateBucket = this.config.get<string>('S3_BUCKET_PRIVATE');
    this.privateUrlPrefix = this.config.get<string>('PRIVATE_FILE_API_URL');
  }

  async uploadTestFile(
    file: UploadedBinaryFile,
    bucketType: 'public' | 'private',
  ) {
    const fileUuid = randomUUID();
    const extension = this.getFileExtension(file.originalname);
    const key = `tests/${bucketType}/${new Date().toISOString().slice(0, 10)}/${fileUuid}${extension}`;
    const { bucket, etag } = await this.uploadBinaryFile({
      file,
      bucketType,
      key,
    });

    const url =
      bucketType === 'public' && this.publicUrlPrefix
        ? joinFileUrl(this.publicUrlPrefix, key)
        : bucketType === 'private' && this.privateUrlPrefix
          ? joinFileUrl(this.privateUrlPrefix, fileUuid)
          : key;

    return {
      bucket,
      key,
      url,
      etag,
    };
  }

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

  async getFileByUuid(uuid: string): Promise<files | null> {
    return this.prisma.files.findFirst({
      where: { uuid },
    });
  }

  async userOwnsPromptFile(
    userId: bigint,
    file: Pick<files, 'ref_table' | 'ref_id'>,
  ): Promise<boolean> {
    if (file.ref_table !== 'prompts') {
      return false;
    }

    const owned = await this.prisma.user_prompts.findUnique({
      where: {
        user_id_prompt_id: {
          user_id: userId,
          prompt_id: file.ref_id,
        },
      },
    });

    return !!owned;
  }

  getFileUrl(file: Pick<files, 'uuid' | 'bucket' | 'url'>): string {
    if (file.url.startsWith('https://')) {
      return file.url;
    }

    if (file.bucket === this.publicBucket && this.publicUrlPrefix) {
      return joinFileUrl(this.publicUrlPrefix, file.url);
    }

    if (file.bucket === this.privateBucket && this.privateUrlPrefix) {
      return joinFileUrl(this.privateUrlPrefix, file.uuid);
    }

    return file.url;
  }

  getBucketName(bucketType: 'public' | 'private'): string {
    const bucket =
      bucketType === 'public' ? this.publicBucket : this.privateBucket;

    if (!bucket) {
      throw new Error(`Missing bucket config for ${bucketType} upload`);
    }

    return bucket;
  }

  async uploadBinaryFile({
    file,
    bucketType,
    key,
  }: {
    file: UploadedBinaryFile;
    bucketType: 'public' | 'private';
    key: string;
  }): Promise<{ bucket: string; key: string; etag: string | null }> {
    const bucket = this.getBucketName(bucketType);
    const result = await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }),
    );

    return {
      bucket,
      key,
      etag: result.ETag ?? null,
    };
  }

  async deleteStoredFile(file: Pick<files, 'bucket' | 'url'>): Promise<void> {
    if (!file.url || file.url.startsWith('https://')) {
      return;
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: file.bucket,
        Key: file.url,
      }),
    );
  }

  async getStoredFileStream(
    file: Pick<files, 'bucket' | 'url'>,
  ): Promise<{ stream: Readable; contentType: string | null }> {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.url,
      }),
    );

    return {
      stream: result.Body as Readable,
      contentType: result.ContentType ?? null,
    };
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex < 0) return '';
    return filename.slice(lastDotIndex);
  }
}
