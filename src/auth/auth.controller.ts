import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ApiOperation } from '@nestjs/swagger';
import {
  EmailRegisterRequest,
  EmailRegisterVerifyRequest,
  GoogleLoginRequest,
  LoginRequest,
} from '../models/user-api';
import { RestResponse } from '../models/rest-response';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '信箱註冊' })
  @Post('register')
  async emailRegistration(@Body() input: EmailRegisterRequest) {
    await this.authService.register(input.email, input.password);
    return RestResponse.success();
  }

  @ApiOperation({ summary: '信箱驗證註冊' })
  @Post('register/verify')
  async verifyEmailRegistration(@Body() input: EmailRegisterVerifyRequest) {
    await this.authService.verifyEmailRegistration(input.email, input.otp);
    return RestResponse.success();
  }

  @ApiOperation({ summary: '信箱登入' })
  @Post('/login')
  async login(@Body() input: LoginRequest) {
    const data = await this.authService.loginByEmail(
      input.email,
      input.password,
    );
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Google登入' })
  @Post('/login/google')
  async googleLogin(@Body() input: GoogleLoginRequest) {
    const data = await this.authService.loginByGoogle(input.token);
    return RestResponse.success(data);
  }

  // @Get('/google/login')
  // @UseGuards(AuthGuard('google'))
  // async googleAuth(@Req() req: Request) {
  //   // 這裡不需要做什麼，Passport 會自動 redirect
  // }
  //
  // @Get('google/callback')
  // @UseGuards(AuthGuard('google'))
  // async googleCallback(@Request() req) {
  //   const user = req.user;
  //
  //   console.log(`google callback user: ${JSON.stringify(user)}`);
  //
  //   const data = this.authService.getLoginResponseData(user);
  //
  //   return RestResponse.success(data);
  // }
}
