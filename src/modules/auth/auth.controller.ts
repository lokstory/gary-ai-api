import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  AuthLoginResponse,
  EmailRegisterRequest,
  EmailRegisterVerifyRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
  GoogleLoginRequest,
  LoginRequest,
} from '../../models/user-api.io';
import { RestResponse } from '../../models/rest.response';
import {
  ApiEmptyRestResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register by email' })
  @ApiEmptyRestResponse()
  @Post('register')
  async emailRegistration(@Body() input: EmailRegisterRequest) {
    await this.authService.register(input);
    return RestResponse.success();
  }

  @ApiOperation({ summary: 'Verify email registration' })
  @ApiEmptyRestResponse()
  @Post('register/verify')
  async verifyEmailRegistration(@Body() input: EmailRegisterVerifyRequest) {
    await this.authService.verifyEmailRegistration(input.email, input.otp);
    return RestResponse.success();
  }

  @ApiOperation({ summary: 'Login by email' })
  @ApiRestResponse(AuthLoginResponse)
  @Post('/login')
  async login(@Body() input: LoginRequest) {
    const data = await this.authService.loginByEmail(
      input.email,
      input.password,
    );
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Login by Google' })
  @ApiRestResponse(AuthLoginResponse)
  @Post('/login/google')
  async googleLogin(@Body() input: GoogleLoginRequest) {
    const data = await this.authService.loginByGoogle(input.token);
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Send forgot password OTP' })
  @ApiEmptyRestResponse()
  @Post('/forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordRequest) {
    await this.authService.sendForgotPasswordCode(input);
    return RestResponse.success();
  }

  @ApiOperation({ summary: 'Verify forgot password OTP and reset password' })
  @ApiRestResponse(AuthLoginResponse)
  @Post('/forgot-password/verify')
  async verifyForgotPassword(@Body() input: ForgotPasswordVerifyRequest) {
    const data = await this.authService.verifyForgotPassword(input);
    return RestResponse.success(data);
  }
}
