import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { AppException } from './models/app.exception';
import { AppCode } from './models/app.code';
import { RestResponse } from './models/rest.response';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }
  //
  // @Get('/ok')
  // testOk() {
  //   return new RestResponse({ data: { user_id: 123 } });
  // }
  //
  // @Get('/error')
  // testError() {
  //   throw new AppException({ code: AppCode.USER_ALREADY_EXISTS });
  // }
  //
  // @Get('/redis/:key')
  // async testRedis(@Param('key') key: string) {
  //   return await this.redisService.get(key || 'hello');
  // }
}
