import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  EmailRegisterRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
} from '../../models/user-api.io';

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

  private generateOtp() {
    return '123456';
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
    const { email, password } = request;
    await this.usersService.assertEmailAvailableForEmailAuth(email);

    const passwordHash = await this.usersService.hashPassword(password);
    const otp = this.generateOtp();
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

    return await this.usersService.createEmailUser(email, payload.password);
  }

  getLoginResponseData(user: any): object {
    const email = user.email ?? user.google_email ?? null;
    const payload = {
      email,
      sub: user.uuid,
      id: user.id.toString(),
      type: 'user',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginByEmail(email: string, password: string): Promise<object> {
    const { emailUser, googleUser } =
      await this.usersService.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
    if (!emailUser) {
      throw new AppException({ code: AppCode.CREDENTIAL_INVALID });
    }

    if (
      !(await this.usersService.verifyPassword(
        emailUser.password_hash!,
        password,
      ))
    ) {
      throw new AppException({ code: AppCode.CREDENTIAL_INVALID });
    }
    return this.getLoginResponseData(emailUser);
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
    if (!email) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    const { emailUser } = await this.usersService.findByAuthEmail(email);
    if (emailUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_EMAIL });
    }

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.createGoogleUser(googleId, email, name);
    }

    console.log(payload);

    return this.getLoginResponseData(user);
  }

  async sendForgotPasswordCode(request: ForgotPasswordRequest) {
    const { email } = request;
    const { emailUser, googleUser } =
      await this.usersService.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
    if (!emailUser) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const otp = this.generateOtp();
    await this.redisService.setJson(`forgot-password:${email}`, { otp }, 300);
  }

  async verifyForgotPassword(request: ForgotPasswordVerifyRequest) {
    const { email, otp, new_password: newPassword } = request;
    const payload = await this.redisService.getJson(`forgot-password:${email}`);
    if (!payload || otp !== payload.otp) {
      throw new AppException({ code: AppCode.VERIFICATION_FAILED });
    }

    const { emailUser, googleUser } =
      await this.usersService.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
    if (!emailUser) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const passwordHash = await this.usersService.hashPassword(newPassword);
    const updatedUser = await this.usersService.updatePasswordById(
      emailUser.id,
      passwordHash,
    );
    await this.redisService.delete(`forgot-password:${email}`);

    return this.getLoginResponseData(updatedUser);
  }
}
