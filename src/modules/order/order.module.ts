import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderCmsController } from './order-cms.controller';
import { OrderWebhookController } from './order-webhook.controller';
import { OrderService } from './order.service';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [PromptModule],
  controllers: [OrderController, OrderCmsController, OrderWebhookController],
  providers: [OrderService],
})
export class OrderModule {}
