import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.register(email, password);
  }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req) {
    return req.user;
  }

  @Get('/google/login')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // 這裡不需要做什麼，Passport 會自動 redirect
  }

  // 2️⃣ Google callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req) {
    const user = req.user;

    console.log(`google callback user: ${JSON.stringify(user)}`);

    const jwt = this.authService.login(user);

    return {
      message: 'Google login successful',
      email: user?.email,
      access_token: jwt.access_token,
    };
  }
}
