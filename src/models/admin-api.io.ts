import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppCode } from './app.code';
import { PASSWORD_REGEX } from './constants';
import { Type } from 'class-transformer';
import {
  PageQuery,
  PromptFileResponse,
  PromptLabelResponse,
} from './user-api.io';

export class AdminLoginRequest {
  @ApiProperty({ example: 'admin' })
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(255)
  username: string;

  @ApiProperty({ example: 'Aa123456@' })
  @Matches(PASSWORD_REGEX, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  password: string;
}

export class AdminLoginResponse {
  @ApiProperty()
  access_token: string;
}

export class AdminMeResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  role: string | null;

  @ApiProperty()
  enabled: boolean;
}

export class AdminListLabelsQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Search label code or name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminCreateLabelRequest {
  @ApiProperty({ example: 'ai.prompt' })
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 'AI Prompt' })
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminUpdateLabelRequest {
  @ApiPropertyOptional({ example: 'ai.prompt' })
  @IsOptional()
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ example: 'AI Prompt' })
  @IsOptional()
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminLabelResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class AdminTestUploadResponse {
  @ApiProperty()
  bucket: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ nullable: true })
  etag: string | null;
}

export class AdminCreatePromptRequest {
  @ApiProperty({ example: 'Cinematic Portrait Prompt Pack' })
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'A prompt pack for cinematic portraits.' })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  description?: string;

  @ApiProperty({ example: 299 })
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  bonus_credit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminUpdatePromptRequest {
  @ApiPropertyOptional({ example: 'Cinematic Portrait Prompt Pack' })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'A prompt pack for cinematic portraits.' })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  description?: string;

  @ApiPropertyOptional({ example: 299 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  bonus_credit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminListPromptsQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Search name or description' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CmsPromptFileResponse extends PromptFileResponse {
  @ApiProperty()
  id: string;
}

export class CmsPromptResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  bonus_credit: number;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ nullable: true })
  created_at: Date | null;

  @ApiProperty({ nullable: true })
  updated_at: Date | null;
}

export class CmsPromptFilesResponse {
  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  cover?: CmsPromptFileResponse | null;

  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  pdf?: CmsPromptFileResponse | null;

  @ApiProperty({ type: [CmsPromptFileResponse] })
  files: CmsPromptFileResponse[];
}

export class CmsPromptFileMutationRequest {
  @ApiPropertyOptional({
    description: 'Existing file primary key. Keep or replace this file when provided.',
    example: '10',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
  })
  @IsOptional()
  id?: string | number | null;

  @ApiPropertyOptional({
    description: 'Multipart form-data file field name for the new uploaded file.',
    example: 'cover_file',
  })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  file_key?: string | null;

  @ApiPropertyOptional({
    description: 'Existing thumbnail file primary key.',
    example: '11',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
  })
  @IsOptional()
  thumbnail_id?: string | number | null;

  @ApiPropertyOptional({
    description: 'Multipart form-data file field name for the new uploaded thumbnail.',
    example: 'cover_thumb',
  })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  thumbnail_file_key?: string | null;

  @ApiPropertyOptional({
    description: 'Media order position.',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  position?: number;
}

export class CmsPromptDownloadMutationRequest {
  @ApiPropertyOptional({
    description: 'Existing pdf file primary key.',
    example: '20',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
  })
  @IsOptional()
  id?: string | number | null;

  @ApiPropertyOptional({
    description: 'Multipart form-data file field name for the new uploaded pdf.',
    example: 'pdf_file',
  })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  file_key?: string | null;
}

export class CmsUpdatePromptFilesPayloadRequest {
  @ApiPropertyOptional({
    type: CmsPromptFileMutationRequest,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @Type(() => CmsPromptFileMutationRequest)
  cover?: CmsPromptFileMutationRequest | null;

  @ApiPropertyOptional({
    type: CmsPromptDownloadMutationRequest,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @Type(() => CmsPromptDownloadMutationRequest)
  pdf?: CmsPromptDownloadMutationRequest | null;

  @ApiPropertyOptional({
    type: [CmsPromptFileMutationRequest],
  })
  @IsOptional()
  @IsArray()
  @Type(() => CmsPromptFileMutationRequest)
  media?: CmsPromptFileMutationRequest[];

  @ApiPropertyOptional({
    description:
      'File primary keys to delete. Accepts numeric string or integer. Child thumbnails will be deleted before parent files.',
    example: ['33'],
  })
  @IsOptional()
  @IsArray()
  delete_ids?: Array<string | number>;
}

export class CmsPromptDetailResponse extends CmsPromptResponse {
  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  cover?: CmsPromptFileResponse | null;

  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  pdf?: CmsPromptFileResponse | null;

  @ApiProperty({ type: [CmsPromptFileResponse] })
  files: CmsPromptFileResponse[];

  @ApiProperty({ type: [PromptLabelResponse] })
  labels: PromptLabelResponse[];
}
