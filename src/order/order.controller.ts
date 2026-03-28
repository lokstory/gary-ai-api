import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../components/user-id.decorator';
import { PaginatedResponse, RestResponse } from '../models/rest.response';
import { SwaggerBearer } from '../models/constants';
import { PageQuery } from '../models/user-api.io';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';
import { OrderItemType } from '../models/enums';
import { UUIDValidationPipe } from '../components/uuid-validation.pipe';

@ApiBearerAuth(SwaggerBearer.USER)
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'List order history' })
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
  @Post('checkout/cart')
  async checkoutFromCart(@UserId() userId: bigint) {
    const result = await this.orderService.checkoutFromCart(userId);
    if (!result) {
      throw new AppException({ code: AppCode.ORDER_CART_EMPTY });
    }
    return RestResponse.success(result);
  }

  @ApiOperation({ summary: 'Direct purchase a prompt by UUID' })
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
