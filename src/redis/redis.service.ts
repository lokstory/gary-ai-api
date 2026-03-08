import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor(private configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('REDIS_URL');
    // const host = this.configService.getOrThrow<string>('REDIS_HOST');
    // const port = this.configService.getOrThrow<number>('REDIS_PORT');

    this.client = new Redis(url);
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const val = JSON.stringify(value);
    if (ttlSeconds) await this.client.set(key, val, 'EX', ttlSeconds);
    else await this.client.set(key, val);
  }

  async get(key: string): Promise<any> {
    const val = await this.client.get(key);
    return val;
  }

  async getJson(key: string): Promise<any> {
    const val = await this.client.get(key);
    return val ? JSON.parse(val) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }
}
