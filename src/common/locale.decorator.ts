import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, LocaleRequest } from './locale.middleware';

export const Locale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<LocaleRequest>();
    return req.locale || DEFAULT_LOCALE;
  },
);
