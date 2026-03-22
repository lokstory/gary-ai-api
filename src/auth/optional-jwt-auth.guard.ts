import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // token 不存在時，直接 pass
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser | null {
    // 注意回傳可以加 | null
    if (err) throw err;

    if (info && info.name === 'JsonWebTokenError') {
      throw new AppException({ code: AppCode.CREDENTIALS_INVALID });
    }

    return user ?? null; // 泛型對齊，TS 不會抱怨
  }

  // 這裡確保沒有 header 也 pass
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) return true;
    return super.canActivate(context) as boolean;
  }
}
