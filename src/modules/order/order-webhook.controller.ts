import { Controller, Headers, HttpCode, Post, RawBody } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import { RestResponse } from '../../models/rest.response';
import { OrderService } from './order.service';

@Controller('orders/webhook')
export class OrderWebhookController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Stripe webhook receiver' })
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!sig) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }
    await this.orderService.handleStripeWebhook(rawBody, sig);
    return RestResponse.success();
  }
}
