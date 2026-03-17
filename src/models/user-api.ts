import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PASSWORD_REGEX } from './constants';
import { AppCode } from './app-code';
import { Type } from 'class-transformer';

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

export class ListPromptsQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100)
  page_size?: number;

  @ApiPropertyOptional({ description: 'Search name or description' })
  @IsOptional()
  search?: string;
}
