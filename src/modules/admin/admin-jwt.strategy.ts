import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('ADMIN_JWT_SECRET') ??
        config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const { sub, username, role, type } = payload;
    if (type !== 'admin') {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    return {
      id: sub,
      username,
      role,
      type,
    };
  }
}
