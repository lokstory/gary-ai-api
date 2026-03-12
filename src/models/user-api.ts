import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import { PASSWORD_REGEX } from './constants';
import { AppCode } from './app-code';

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
