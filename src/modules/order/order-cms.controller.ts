import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../components/api-response.decorator';
import {
  AdminListOrdersQuery,
  CmsOrderResponse,
} from '../../models/admin-api.io';
import { SwaggerBearer } from '../../models/constants';
import { PaginatedResponse } from '../../models/rest.response';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { OrderService } from './order.service';

@ApiTags('CMS Orders')
@Controller('cms/orders')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class OrderCmsController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'List orders' })
  @ApiPaginatedResponse(CmsOrderResponse)
  @Get()
  async listOrders(@Query() query: AdminListOrdersQuery) {
    const { data, page, pageSize, total } =
      await this.orderService.listAdminOrders({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
        orderUuid: query.order_uuid,
        displayId: query.display_id,
        status: query.status,
        userUuid: query.user_uuid,
      });

    return PaginatedResponse.success({ data, page, pageSize, total });
  }
}
