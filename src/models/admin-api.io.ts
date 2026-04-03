import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AppCode } from './app.code';
import { PASSWORD_REGEX } from './constants';
import { Type } from 'class-transformer';
import { PageQuery } from './user-api.io';

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
