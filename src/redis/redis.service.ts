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

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      return await this.client.set(key, value);
    }
  }

  async setJson(key: string, value: any, ttlSeconds?: number) {
    return await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async get(key: string): Promise<any> {
    return await this.client.get(key);
  }

  async getJson(key: string): Promise<any> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string) {
    await this.client.del(key);
  }
}
