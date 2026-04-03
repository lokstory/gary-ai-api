import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { UserId } from '../../components/user-id.decorator';
import { UUIDValidationPipe } from '../../components/uuid-validation.pipe';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import { SwaggerBearer } from '../../models/constants';
import { OrderItemType } from '../../models/enums';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import {
  OrderCheckoutResponse,
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
  async listOrders(@UserId() userId: bigint, @Query() query: PageQuery) {
    const { items, total } = await this.orderService.listOrders(userId, query);
    return PaginatedResponse.success({
      data: items,
      page: query.page,
      pageSize: query.page_size,
      total,
    });
  }

  @ApiOperation({ summary: 'Checkout all items in cart' })
  @ApiRestResponse(OrderCheckoutResponse)
  @Post('checkout/cart')
  async checkoutFromCart(@UserId() userId: bigint) {
    const result = await this.orderService.checkoutFromCart(userId);
    if (!result) {
      throw new AppException({ code: AppCode.ORDER_CART_EMPTY });
    }
    return RestResponse.success(result);
  }

  @ApiOperation({ summary: 'Direct purchase a prompt by UUID' })
  @ApiRestResponse(OrderCheckoutResponse)
  @Post('checkout/prompts/:uuid')
  async checkoutPromptDirect(
    @UserId() userId: bigint,
    @Param('uuid', UUIDValidationPipe) uuid: string,
  ) {
    const prompt = await this.orderService.getPromptByPublicId(uuid);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const result = await this.orderService.checkoutDirect(
      userId,
      OrderItemType.PROMPT,
      prompt.id,
    );

    if (!result) {
      throw new AppException({ code: AppCode.ORDER_CHECKOUT_FAILED });
    }

    return RestResponse.success(result);
  }
}
