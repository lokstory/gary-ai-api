import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { s3Client } from './components/aws-s3.client';
import { ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RestResponse } from './models/rest.response';

@Controller('/tests')
export class TestController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get('/s3-buckets')
  async listS3Buckets(): Promise<any> {
    // const bucket = process.env.S3_BUCKET!;
    const ret = await s3Client.send(
      new ListObjectsV2Command({ Bucket: 'dev-gary-ai-public' }),
    );
    return RestResponse.success(ret);
  }
}
