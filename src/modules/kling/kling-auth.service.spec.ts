import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { KlingAuthService } from './kling-auth.service';

describe('KlingAuthService', () => {
  it('creates a JWT bearer token signed with the secret key', () => {
    const config = {
      getOrThrow(key: string) {
        if (key === 'KLING_AI_ACCESS_KEY') return 'test-ak';
        if (key === 'KLING_AI_SECRET_KEY') return 'test-sk';
        throw new Error(`Unexpected key: ${key}`);
      },
    } as ConfigService;
    const service = new KlingAuthService(config);

    const token = service.createBearerToken();
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    expect(encodedHeader).toBeDefined();
    expect(encodedPayload).toBeDefined();
    expect(signature).toBeDefined();

    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    );
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
    const expectedSignature = createHmac('sha256', 'test-sk')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload.iss).toBe('test-ak');
    expect(payload.exp).toBeGreaterThan(payload.nbf);
    expect(signature).toBe(expectedSignature);
  });
});
