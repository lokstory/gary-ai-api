import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AdminId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): bigint | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id ? BigInt(request.user.id as string) : null;
  },
);
