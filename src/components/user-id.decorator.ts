import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getUserId } from '../utils/user.util';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): bigint | null => {
    const request = ctx.switchToHttp().getRequest();
    return getUserId(request);
  },
);
