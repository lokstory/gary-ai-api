import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_REGEX } from './constants';
import { AppCode } from './app.code';
import { Type } from 'class-transformer';
import { MediaType } from './enums';

export class PageQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100)
  page_size: number = 20;
}

export class EmailRegisterRequest {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail(undefined, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  email: string;

  @ApiProperty({ example: 'Aa123456@' })
  @Matches(PASSWORD_REGEX, {
    message:
      'password must contain uppercase, lowercase, number and special character',
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Nickname',
    maxLength: 64,
    example: 'Tom',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;
}

export class EmailRegisterVerifyRequest {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail(undefined, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  email: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  otp: string;
}

export class LoginRequest {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail(undefined, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  email: string;

  @ApiProperty({ example: 'Aa123456@' })
  @Matches(PASSWORD_REGEX, {
    context: { code: AppCode.PARAMETER_ERROR[0] },
  })
  password: string;
}

export class GoogleLoginRequest {
  @ApiProperty({ example: 'Google credential (id token)' })
  @IsString()
  token: string;
}

export class AuthLoginResponse {
  @ApiProperty()
  access_token: string;
}

export class ListPromptsQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Search prompt name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Prompt media type' })
  @IsOptional()
  @IsEnum(MediaType, { context: { code: AppCode.PARAMETER_ERROR[0] } })
  media_type?: MediaType;

  @ApiPropertyOptional({ description: 'Filter by category code' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UserInfoResponse {
  @ApiProperty({ description: 'Public UUID for API' })
  uuid: string;

  @ApiProperty({ description: 'Email' })
  email?: string | null;

  @ApiProperty({ description: 'Nickname' })
  name?: string | null;

  @ApiPropertyOptional({
    description: 'Preferred locale',
    nullable: true,
    maxLength: 16,
    example: 'en',
  })
  locale?: string | null;

  constructor(partial: Partial<UserInfoResponse>) {
    Object.assign(this, partial);
  }
}

export class PromptFileResponse {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  file_type: string;

  @ApiProperty()
  position: number;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnail_url?: string | null;

  @ApiPropertyOptional({ nullable: true })
  created_at?: Date | null;
}

export class PromptLabelResponse {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class PromptCategoryResponse {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class PromptUserStateResponse {
  @ApiProperty()
  is_favorite: boolean;

  @ApiProperty()
  purchased: boolean;
}

export class PromptResponse {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  bonus_credit: number;

  @ApiPropertyOptional({ enum: MediaType, nullable: true })
  media_type?: MediaType | null;

  @ApiPropertyOptional({ type: PromptCategoryResponse, nullable: true })
  category?: PromptCategoryResponse | null;

  @ApiPropertyOptional({ nullable: true })
  created_at?: Date | null;

  @ApiPropertyOptional({ type: PromptFileResponse, nullable: true })
  cover?: PromptFileResponse | null;

  @ApiPropertyOptional({ type: PromptFileResponse, nullable: true })
  pdf?: PromptFileResponse | null;

  @ApiPropertyOptional({ type: PromptFileResponse, nullable: true })
  zip?: PromptFileResponse | null;

  @ApiProperty({ type: [PromptFileResponse] })
  files: PromptFileResponse[];

  @ApiProperty({ type: [PromptLabelResponse] })
  labels: PromptLabelResponse[];

  @ApiProperty({ type: PromptUserStateResponse })
  user_state: PromptUserStateResponse;
}

export class CartItemResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  item_type: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional({ type: PromptResponse, nullable: true })
  item?: PromptResponse | null;
}

export class OrderLineItemResponse {
  @ApiProperty()
  item_type: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unit_price: number;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional({ type: PromptResponse, nullable: true })
  item?: PromptResponse | null;
}

export class OrderPaymentResponse {
  @ApiPropertyOptional({ nullable: true })
  expires_at?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  checkout_url?: string | null;
}

export class OrderResponse {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional({ type: OrderPaymentResponse, nullable: true })
  payment?: OrderPaymentResponse | null;

  @ApiProperty({ type: [OrderLineItemResponse] })
  items: OrderLineItemResponse[];
}

export class UpdateUserInfoRequest {
  @ApiPropertyOptional({
    description: 'Nickname',
    maxLength: 64,
    example: 'Tom',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({
    description: 'Preferred locale',
    nullable: true,
    maxLength: 16,
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string | null;
}
