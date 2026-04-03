import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './modules/redis/redis.service';
import { s3Client } from './components/aws-s3.client';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RestResponse } from './models/rest.response';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Controller('/tests')
export class TestController {
  private stripe: Stripe;

  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'));
  }

  @Get('/stripe/session/:id')
  async getStripeSession(@Param('id') id: string) {
    const session = await this.stripe.checkout.sessions.retrieve(id);
    return RestResponse.success(session);
  }

  @Get('/s3-buckets')
  async listS3Buckets(): Promise<any> {
    // const bucket = process.env.S3_BUCKET!;
    const ret = await s3Client.send(
      new ListObjectsV2Command({ Bucket: 'dev-gary-ai-public' }),
    );
    return RestResponse.success(ret);
  }
}
