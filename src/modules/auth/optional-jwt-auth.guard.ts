import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser | null {
    if (err instanceof AppException) {
      throw err;
    }

    if (err) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    if (info && info.name === 'JsonWebTokenError') {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    return user ?? null;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) return true;
    return super.canActivate(context) as boolean;
  }
}
