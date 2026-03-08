import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerId = req.headers['x-request-id'];

    const requestId =
      typeof headerId === 'string' && headerId.length > 0
        ? headerId
        : randomUUID();

    (req as any).requestId = requestId;

    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
