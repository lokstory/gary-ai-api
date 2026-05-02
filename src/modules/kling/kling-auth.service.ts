import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { KlingCredentials } from './kling.types';

@Injectable()
export class KlingAuthService {
  private static readonly DEFAULT_TOKEN_TTL_SECONDS = 30 * 60;

  constructor(private readonly config: ConfigService) {}

  getDefaultCredentials(): KlingCredentials {
    return {
      accessKey: this.config.getOrThrow<string>('KLING_AI_ACCESS_KEY'),
      secretKey: this.config.getOrThrow<string>('KLING_AI_SECRET_KEY'),
    };
  }

  createBearerToken(credentials?: KlingCredentials): string {
    const resolvedCredentials = credentials ?? this.getDefaultCredentials();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: resolvedCredentials.accessKey,
      nbf: now - 5,
      exp: now + KlingAuthService.DEFAULT_TOKEN_TTL_SECONDS,
    };
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = this.encodeBase64Url(header);
    const encodedPayload = this.encodeBase64Url(payload);
    const signature = createHmac('sha256', resolvedCredentials.secretKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private encodeBase64Url(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
