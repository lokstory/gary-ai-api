import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';
import { EmailRegisterRequest } from '../models/user-api.io';

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

  async register(request: EmailRegisterRequest) {
    const { name, email, password } = request;
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
      sub: user.public_id,
      id: user.id.toString(),
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
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
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
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
    }

    // Payload example:
    // {
    //   iss: 'https://accounts.google.com',
    //   azp: '968092202652-pvbtm2r21j3p18b4dlad5j7lcr25aubv.apps.googleusercontent.com',
    //   aud: '968092202652-pvbtm2r21j3p18b4dlad5j7lcr25aubv.apps.googleusercontent.com',
    //   sub: '110142156374425089757',
    //   email: 'lokstory@gmail.com',
    //   email_verified: true,
    //   nbf: 1773574187,
    //   name: 'Shiun Jiang',
    //   picture: 'https://lh3.googleusercontent.com/a/ACg8ocKwxModDGAJsPxSlIa44fUenhRI_VzzHVnChtaODKeF4Ym8KX2kiA=s96-c',
    //   given_name: 'Shiun',
    //   family_name: 'Jiang',
    //   iat: 1773574487,
    //   exp: 1773578087,
    //   jti: '26821d4124e333602f0e26617429053942270257'
    // }

    const { sub: googleId, email, name, picture, exp } = payload;
    if (exp && Math.floor(Date.now() / 1000) > exp) {
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
    }

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.createGoogleUser(googleId, email!);
    }

    console.log(payload);

    // 你可以只取需要的欄位
    return this.getLoginResponseData(user);
  }
}
