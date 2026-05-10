import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KlingAuthService } from './kling-auth.service';
import { KlingCredentials } from './kling.types';

@Injectable()
export class KlingHttpClient {
  private readonly logger = new Logger(KlingHttpClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly klingAuthService: KlingAuthService,
  ) {
    this.baseUrl = this.config.get<string>('KLING_AI_BASE_URL')?.trim()
      ? this.config.getOrThrow<string>('KLING_AI_BASE_URL').trim()
      : 'https://api.klingai.com';
  }

  async get<TResponse>(
    path: string,
    credentials?: KlingCredentials,
  ): Promise<TResponse> {
    return this.request<TResponse>('GET', path, undefined, credentials);
  }

  async post<TResponse>(
    path: string,
    body: unknown,
    credentials?: KlingCredentials,
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', path, body, credentials);
  }

  private async request<TResponse>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    credentials?: KlingCredentials,
  ): Promise<TResponse> {
    const token = this.klingAuthService.createBearerToken(credentials);
    const url = new URL(path, this.baseUrl).toString();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Kling API error';
      this.logger.error(
        `Kling API request failed: ${method} ${url} - ${message}`,
      );
      throw new InternalServerErrorException('Kling API request failed');
    }

    const responseBody = await this.parseResponseBody(response);

    if (!response.ok) {
      this.logger.error(
        `Kling API returned ${response.status} for ${method} ${url}`,
      );
      throw new InternalServerErrorException({
        message: 'Kling API request failed',
        statusCode: response.status,
        response: responseBody,
      });
    }

    return responseBody as TResponse;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    return text ? { raw: text } : null;
  }
}
