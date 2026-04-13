import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { EmailRegisterRequest } from '../../models/user-api.io';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UserService,
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

  async register(request: EmailRegisterRequest) {
    const { name, email, password } = request;
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
    }

    const passwordHash = await this.usersService.hashPassword(password);
    const otp = '123456';
    await this.redisService.setJson(
      `register:${email}`,
      {
        email,
        name,
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

    return await this.usersService.createEmailUser(
      email,
      payload.password,
      payload.name,
    );
  }

  getLoginResponseData(user: any): object {
    const payload = {
      email: user.email,
      sub: user.uuid,
      id: user.id.toString(),
      type: 'user',
    };
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
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }
    return this.getLoginResponseData(user);
  }

  async loginByGoogle(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    });

    console.log(ticket);

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    const { sub: googleId, email, name, picture, exp } = payload;
    if (exp && Math.floor(Date.now() / 1000) > exp) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.createGoogleUser(googleId, email!);
    }

    console.log(payload);

    return this.getLoginResponseData(user);
  }
}
