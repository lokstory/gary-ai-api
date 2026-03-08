import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/redis/:key')
  async testRedis(@Param('key') key: string) {
    return await this.redisService.get(key || 'hello');
  }
}
