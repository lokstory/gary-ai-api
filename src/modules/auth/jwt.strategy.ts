import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const { email, sub: uuid, id, type } = payload;
    if (type !== 'user') {
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
    }

    return {
      email,
      uuid,
      id,
      type,
    };
  }
}
