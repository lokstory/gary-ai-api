import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../models/app-exception';
import { AppCode } from '../models/app-code';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password_hash === password) {
      const { password_hash: _password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }

    const passwordHash = await this.usersService.hashPassword(password);
    const otp = '123456';
    await this.redisService.setJson(
      `register:${email}`,
      {
        email,
        password: passwordHash,
        otp,
      },
      300,
    );
  }

  async verifyEmailRegistration(email: string, otp: string) {
    const payload = await this.redisService.getJson(`register:${email}`);
    if (!payload || otp !== payload.otp) {
      throw new AppException({ code: AppCode.VERIFICATION_FAILED });
    }

    return await this.usersService.createUser(email, payload.password);
  }

  getLoginResponseData(user: any): object {
    const payload = { email: user.email, sub: user.public_id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginByEmail(email: string, password: string): Promise<object> {
    const user = await this.usersService.findByEmail(email);
    if (
      !user ||
      !(await this.usersService.verifyPassword(user.password_hash!, password))
    ) {
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
    }
    return this.getLoginResponseData(user);
  }

  // 驗證前端傳來的 id_token
  async verifyGoogleToken(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token');
    }

    // 你可以只取需要的欄位
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
