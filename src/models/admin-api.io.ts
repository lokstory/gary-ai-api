import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AppCode } from './app.code';
import { PASSWORD_REGEX } from './constants';
import { Type } from 'class-transformer';
import {
  PageQuery,
  PromptFileResponse,
} from './user-api.io';
import { MediaType } from './enums';

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

export class AdminNameTranslationRequest {
  @ApiProperty({ example: 'en' })
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @MinLength(2)
  @MaxLength(16)
  locale: string;

  @ApiProperty({ example: 'AI Prompt' })
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @MinLength(1)
  @MaxLength(255)
  name: string;
}

export class AdminPromptTranslationRequest extends AdminNameTranslationRequest {
  @ApiPropertyOptional({ example: 'A prompt pack for cinematic portraits.' })
  @IsOptional()
  @IsString({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  description?: string | null;
}

export class AdminNameTranslationResponse {
  @ApiProperty()
  locale: string;

  @ApiProperty()
  name: string;
}

export class AdminPromptTranslationResponse extends AdminNameTranslationResponse {
  @ApiPropertyOptional({ nullable: true })
  description: string | null;
}

export class AdminCreateLabelRequest {
  @ApiProperty({ example: 'ai.prompt' })
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(100)
  code: string;

  @ApiProperty({ type: [AdminNameTranslationRequest] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNameTranslationRequest)
  translations: AdminNameTranslationRequest[];

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

  @ApiPropertyOptional({ type: [AdminNameTranslationRequest] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNameTranslationRequest)
  translations?: AdminNameTranslationRequest[];

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

  @ApiProperty({ type: [AdminNameTranslationResponse] })
  translations: AdminNameTranslationResponse[];

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class AdminListCategoriesQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Search category code or name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminCreateCategoryRequest {
  @ApiProperty({ example: 'portrait' })
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(100)
  code: string;

  @ApiProperty({ type: [AdminNameTranslationRequest] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNameTranslationRequest)
  translations: AdminNameTranslationRequest[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminUpdateCategoryRequest {
  @ApiPropertyOptional({ example: 'portrait' })
  @IsOptional()
  @IsString({
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  @MinLength(1)
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ type: [AdminNameTranslationRequest] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNameTranslationRequest)
  translations?: AdminNameTranslationRequest[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AdminCategoryResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ type: [AdminNameTranslationResponse] })
  translations: AdminNameTranslationResponse[];

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class CmsPromptCategoryResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: [AdminNameTranslationResponse] })
  translations: AdminNameTranslationResponse[];
}

export class CmsPromptLabelResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: [AdminNameTranslationResponse] })
  translations: AdminNameTranslationResponse[];
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
  @ApiProperty({ type: [AdminPromptTranslationRequest] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPromptTranslationRequest)
  translations: AdminPromptTranslationRequest[];

  @ApiPropertyOptional({ enum: MediaType, nullable: true })
  @IsOptional()
  @IsEnum(MediaType, { context: { code: AppCode.PARAMETER_ERROR[0] } })
  media_type?: MediaType | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(1)
  category_id?: number | null;

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
  @ApiPropertyOptional({ type: [AdminPromptTranslationRequest] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPromptTranslationRequest)
  translations?: AdminPromptTranslationRequest[];

  @ApiPropertyOptional({ enum: MediaType, nullable: true })
  @IsOptional()
  @IsEnum(MediaType, { context: { code: AppCode.PARAMETER_ERROR[0] } })
  media_type?: MediaType | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(1)
  category_id?: number | null;

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

  @ApiProperty({ type: [AdminPromptTranslationResponse] })
  translations: AdminPromptTranslationResponse[];

  @ApiPropertyOptional({ enum: MediaType, nullable: true })
  media_type: MediaType | null;

  @ApiPropertyOptional({ type: CmsPromptCategoryResponse, nullable: true })
  category: CmsPromptCategoryResponse | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  bonus_credit: number;

  @ApiProperty()
  featured_rank: number;

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

  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  zip?: CmsPromptFileResponse | null;

  @ApiProperty({ type: [CmsPromptFileResponse] })
  files: CmsPromptFileResponse[];
}

export class CmsFeaturedPromptItemRequest {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(1)
  id: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt({ context: { code: AppCode.PARAMETER_ERROR[0] } })
  @Min(0)
  rank: number;
}

export class CmsUpdateFeaturedPromptsRequest {
  @ApiPropertyOptional({ type: [CmsFeaturedPromptItemRequest], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsFeaturedPromptItemRequest)
  items?: CmsFeaturedPromptItemRequest[];
}

export class CmsPromptFileMutationRequest {
  @ApiPropertyOptional({
    description:
      'Existing file primary key. Keep or replace this file when provided.',
    example: '10',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
  })
  @IsOptional()
  id?: string | number | null;

  @ApiPropertyOptional({
    description:
      'Multipart form-data file field name for the new uploaded file.',
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
    description:
      'Multipart form-data file field name for the new uploaded thumbnail.',
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
    description: 'Existing download file primary key.',
    example: '20',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
  })
  @IsOptional()
  id?: string | number | null;

  @ApiPropertyOptional({
    description:
      'Multipart form-data file field name for the new uploaded download file.',
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
    type: CmsPromptDownloadMutationRequest,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @Type(() => CmsPromptDownloadMutationRequest)
  zip?: CmsPromptDownloadMutationRequest | null;

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

  @ApiPropertyOptional({ type: CmsPromptFileResponse, nullable: true })
  zip?: CmsPromptFileResponse | null;

  @ApiProperty({ type: [CmsPromptFileResponse] })
  files: CmsPromptFileResponse[];

  @ApiProperty({ type: [CmsPromptLabelResponse] })
  labels: CmsPromptLabelResponse[];
}
