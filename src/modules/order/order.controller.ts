import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { Locale } from '../../common/locale.decorator';
import { UserId } from '../../components/user-id.decorator';
import { UUIDValidationPipe } from '../../components/uuid-validation.pipe';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import { SwaggerBearer } from '../../models/constants';
import { OrderItemType } from '../../models/enums';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import {
  CheckoutSessionOrderRequest,
  OrderResponse,
  PageQuery,
} from '../../models/user-api.io';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';

@ApiBearerAuth(SwaggerBearer.USER)
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'List order history' })
  @ApiPaginatedResponse(OrderResponse)
  @Get()
  async listOrders(
    @UserId() userId: bigint,
    @Query() query: PageQuery,
    @Locale() locale: string,
  ) {
    const { items, total } = await this.orderService.listOrders(
      userId,
      query,
      locale,
    );
    return PaginatedResponse.success({
      data: items,
      page: query.page,
      pageSize: query.page_size,
      total,
    });
  }

  @ApiOperation({ summary: 'Checkout all items in cart' })
  @ApiRestResponse(OrderResponse)
  @Post('checkout/cart')
  async checkoutFromCart(@UserId() userId: bigint, @Locale() locale: string) {
    const result = await this.orderService.checkoutFromCart(userId, locale);
    if (!result) {
      throw new AppException({ code: AppCode.ORDER_CART_EMPTY });
    }
    return RestResponse.success(result);
  }

  @ApiOperation({ summary: 'Direct purchase a prompt by UUID' })
  @ApiRestResponse(OrderResponse)
  @Post('checkout/prompts/:uuid')
  async checkoutPromptDirect(
    @UserId() userId: bigint,
    @Param('uuid', UUIDValidationPipe) uuid: string,
    @Locale() locale: string,
  ) {
    const prompt = await this.orderService.getPromptByPublicId(uuid);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const result = await this.orderService.checkoutDirect(
      userId,
      OrderItemType.PROMPT,
      prompt.id,
      locale,
    );

    if (!result) {
      throw new AppException({ code: AppCode.ORDER_CHECKOUT_FAILED });
    }

    return RestResponse.success(result);
  }

  @ApiOperation({
    summary: 'Sync and get order detail by Stripe Checkout Session ID',
  })
  @ApiRestResponse(OrderResponse)
  @Post('checkout/session')
  async syncOrderByCheckoutSession(
    @UserId() userId: bigint,
    @Body() input: CheckoutSessionOrderRequest,
    @Locale() locale: string,
  ) {
    const normalizedSessionId = input.session_id.trim();
    if (!normalizedSessionId) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const order = await this.orderService.syncOrderByCheckoutSession(
      userId,
      normalizedSessionId,
      locale,
    );
    if (!order) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success(order);
  }

  @ApiOperation({ summary: 'Get order detail by UUID' })
  @ApiRestResponse(OrderResponse)
  @Get(':uuid')
  async getOrder(
    @UserId() userId: bigint,
    @Param('uuid', UUIDValidationPipe) uuid: string,
    @Locale() locale: string,
  ) {
    const order = await this.orderService.getOrderByUuid(userId, uuid, locale);
    if (!order) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success(order);
  }
}
