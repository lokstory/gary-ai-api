import { Module } from '@nestjs/common';
import { KlingAuthService } from './kling-auth.service';
import { KlingHttpClient } from './kling-http.client';
import { KlingProvider } from './kling.provider';
import { KlingService } from './kling.service';
import { KlingWebhookController } from './kling-webhook.controller';

@Module({
  controllers: [KlingWebhookController],
  providers: [KlingAuthService, KlingHttpClient, KlingProvider, KlingService],
  exports: [KlingAuthService, KlingHttpClient, KlingProvider, KlingService],
})
export class KlingModule {}
