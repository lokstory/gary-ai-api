import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const DEFAULT_LOCALE = 'en';

export type LocaleRequest = Request & {
  locale?: string;
};

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: LocaleRequest, _res: Response, next: NextFunction) {
    const headerValue = req.header('x-locale');
    req.locale = headerValue?.trim() || DEFAULT_LOCALE;
    next();
  }
}
