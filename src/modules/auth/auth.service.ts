import { HttpStatus, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
// import { randomInt } from 'crypto';
import {
  EmailRegisterRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
} from '../../models/user-api.io';

type OtpPurpose = 'register' | 'forgot-password';

interface OtpRateLimitConfig {
  cooldownSeconds: number;
  perEmailWindowSeconds: number;
  maxPerEmailPerWindow: number;
  globalWindowSeconds: number;
  maxGlobalPerWindow: number;
}

interface RegisterOtpPayload {
  email: string;
  password: string;
  otp: string;
}

interface ForgotPasswordOtpPayload {
  otp: string;
}

const DEFAULT_OTP_RATE_LIMIT_CONFIG: OtpRateLimitConfig = {
  cooldownSeconds: 60,
  perEmailWindowSeconds: 3600,
  maxPerEmailPerWindow: 10,
  globalWindowSeconds: 3600,
  maxGlobalPerWindow: 1000,
};

const OTP_RATE_LIMIT_CONFIG_KEY = 'auth_otp_rate_limit_config';
const OTP_TTL_SECONDS = 300;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private prisma: PrismaService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private generateOtp() {
    // TODO: Enable cryptographically secure OTP generation when email sending is wired.
    // return Array.from({ length: 6 }, () => randomInt(0, 10).toString()).join(
    //   '',
    // );
    return '123456';
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private parsePositiveInteger(value: unknown, fallback: number) {
    return Number.isInteger(value) && Number(value) > 0
      ? Number(value)
      : fallback;
  }

  private async getOtpRateLimitConfig(): Promise<OtpRateLimitConfig> {
    const record = await this.prisma.kv_store.findUnique({
      where: { json_key: OTP_RATE_LIMIT_CONFIG_KEY },
    });
    const value =
      record?.json_value &&
      typeof record.json_value === 'object' &&
      !Array.isArray(record.json_value)
        ? (record.json_value as Record<string, unknown>)
        : {};

    return {
      cooldownSeconds: this.parsePositiveInteger(
        value.cooldownSeconds,
        DEFAULT_OTP_RATE_LIMIT_CONFIG.cooldownSeconds,
      ),
      perEmailWindowSeconds: this.parsePositiveInteger(
        value.perEmailWindowSeconds,
        DEFAULT_OTP_RATE_LIMIT_CONFIG.perEmailWindowSeconds,
      ),
      maxPerEmailPerWindow: this.parsePositiveInteger(
        value.maxPerEmailPerWindow,
        DEFAULT_OTP_RATE_LIMIT_CONFIG.maxPerEmailPerWindow,
      ),
      globalWindowSeconds: this.parsePositiveInteger(
        value.globalWindowSeconds,
        DEFAULT_OTP_RATE_LIMIT_CONFIG.globalWindowSeconds,
      ),
      maxGlobalPerWindow: this.parsePositiveInteger(
        value.maxGlobalPerWindow,
        DEFAULT_OTP_RATE_LIMIT_CONFIG.maxGlobalPerWindow,
      ),
    };
  }

  private getWindowBucket(windowSeconds: number) {
    return Math.floor(Date.now() / (windowSeconds * 1000));
  }

  private throwOtpRateLimited(message: string) {
    throw new AppException({
      code: AppCode.OTP_RATE_LIMITED,
      message,
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  }

  private async assertOtpRateLimit(purpose: OtpPurpose, email: string) {
    const config = await this.getOtpRateLimitConfig();
    const cooldownKey = `auth:otp:rate-limit:${purpose}:${email}:cooldown`;
    const cooldownSet = await this.redisService.setNx(
      cooldownKey,
      '1',
      config.cooldownSeconds,
    );

    if (!cooldownSet) {
      this.throwOtpRateLimited(
        `Please wait ${config.cooldownSeconds} seconds before requesting another OTP.`,
      );
    }

    const emailWindowBucket = this.getWindowBucket(
      config.perEmailWindowSeconds,
    );
    const emailCount = await this.redisService.incrWithExpire(
      `auth:otp:rate-limit:${purpose}:${email}:email:${emailWindowBucket}`,
      config.perEmailWindowSeconds,
    );
    if (emailCount > config.maxPerEmailPerWindow) {
      this.throwOtpRateLimited('Too many OTP requests for this email.');
    }

    const globalWindowBucket = this.getWindowBucket(config.globalWindowSeconds);
    const globalCount = await this.redisService.incrWithExpire(
      `auth:otp:rate-limit:${purpose}:global:${globalWindowBucket}`,
      config.globalWindowSeconds,
    );
    if (globalCount > config.maxGlobalPerWindow) {
      this.throwOtpRateLimited(
        'Too many OTP requests. Please try again later.',
      );
    }
  }

  private async sendOtpEmail(purpose: OtpPurpose, email: string, otp: string) {
    // TODO: Wire this to SES or another mail provider. Redis OTP is updated now.
    if (this.configService.get<string>('AUTH_OTP_DEBUG_LOG') === 'true') {
      console.log(`[otp:${purpose}] ${email} ${otp}`);
    }
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
    const email = this.normalizeEmail(request.email);
    const { password } = request;
    await this.usersService.assertEmailAvailableForEmailAuth(email);
    await this.assertOtpRateLimit('register', email);

    const passwordHash = await this.usersService.hashPassword(password);
    const otp = this.generateOtp();
    await this.redisService.setJson(
      `register:${email}`,
      {
        email,
        password: passwordHash,
        otp,
      },
      OTP_TTL_SECONDS,
    );
    await this.sendOtpEmail('register', email, otp);
  }

  async resendEmailRegistrationCode(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    await this.usersService.assertEmailAvailableForEmailAuth(email);

    const payload = (await this.redisService.getJson(
      `register:${email}`,
    )) as RegisterOtpPayload | null;
    if (!payload) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.assertOtpRateLimit('register', email);
    const otp = this.generateOtp();
    await this.redisService.setJson(
      `register:${email}`,
      {
        ...payload,
        email,
        otp,
      },
      OTP_TTL_SECONDS,
    );
    await this.sendOtpEmail('register', email, otp);
  }

  async verifyEmailRegistration(email: string, otp: string) {
    email = this.normalizeEmail(email);
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
    const email = this.normalizeEmail(request.email);
    const { emailUser, googleUser } =
      await this.usersService.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
    if (!emailUser) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.assertOtpRateLimit('forgot-password', email);
    const otp = this.generateOtp();
    await this.redisService.setJson(
      `forgot-password:${email}`,
      { otp },
      OTP_TTL_SECONDS,
    );
    await this.sendOtpEmail('forgot-password', email, otp);
  }

  async resendForgotPasswordCode(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const { emailUser, googleUser } =
      await this.usersService.findByAuthEmail(email);

    if (googleUser) {
      throw new AppException({ code: AppCode.USER_REGISTERED_WITH_GOOGLE });
    }
    if (!emailUser) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const payload = (await this.redisService.getJson(
      `forgot-password:${email}`,
    )) as ForgotPasswordOtpPayload | null;
    if (!payload) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.assertOtpRateLimit('forgot-password', email);
    const otp = this.generateOtp();
    await this.redisService.setJson(
      `forgot-password:${email}`,
      { otp },
      OTP_TTL_SECONDS,
    );
    await this.sendOtpEmail('forgot-password', email, otp);
  }

  async verifyForgotPassword(request: ForgotPasswordVerifyRequest) {
    const email = this.normalizeEmail(request.email);
    const { otp, new_password: newPassword } = request;
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
