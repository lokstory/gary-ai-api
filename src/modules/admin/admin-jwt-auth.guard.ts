import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (err instanceof AppException) {
      throw err;
    }

    if (err || !user) {
      throw new AppException({ code: AppCode.UNAUTHORIZED });
    }

    return user;
  }
}
