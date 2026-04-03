import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  AdminLabelResponse,
  AdminCreateLabelRequest,
  AdminListLabelsQuery,
  AdminUpdateLabelRequest,
} from '../../models/admin-api.io';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import { SwaggerBearer } from '../../models/constants';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { LabelService } from './label.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import {
  ApiEmptyRestResponse,
  ApiPaginatedResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';

@Controller('cms/labels')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class LabelCmsController {
  constructor(private readonly labelService: LabelService) {}

  @ApiOperation({ summary: 'List labels' })
  @ApiPaginatedResponse(AdminLabelResponse)
  @Get()
  async listLabels(@Query() query: AdminListLabelsQuery) {
    const { items, total, page, pageSize } = await this.labelService.listLabels(
      {
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
      },
    );

    return PaginatedResponse.success({
      data: items.map((item) => this.labelService.toResponse(item)),
      page,
      pageSize,
      total,
    });
  }

  @ApiOperation({ summary: 'Get label by id' })
  @ApiRestResponse(AdminLabelResponse)
  @Get(':id')
  async getLabel(@Param('id') id: string) {
    const labelId = Number(id);
    if (!Number.isInteger(labelId) || labelId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const label = await this.labelService.getLabelById(labelId);
    if (!label) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success(this.labelService.toResponse(label));
  }

  @ApiOperation({ summary: 'Create label' })
  @ApiRestResponse(AdminLabelResponse)
  @Post()
  async createLabel(@Body() input: AdminCreateLabelRequest) {
    const label = await this.labelService.createLabel(input);
    return RestResponse.success(this.labelService.toResponse(label));
  }

  @ApiOperation({ summary: 'Update label' })
  @ApiRestResponse(AdminLabelResponse)
  @Patch(':id')
  async updateLabel(
    @Param('id') id: string,
    @Body() input: AdminUpdateLabelRequest,
  ) {
    const labelId = Number(id);
    if (!Number.isInteger(labelId) || labelId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const label = await this.labelService.updateLabel(labelId, input);
    return RestResponse.success(this.labelService.toResponse(label));
  }

  @ApiOperation({ summary: 'Delete label' })
  @ApiEmptyRestResponse()
  @Delete(':id')
  async deleteLabel(@Param('id') id: string) {
    const labelId = Number(id);
    if (!Number.isInteger(labelId) || labelId <= 0) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    await this.labelService.deleteLabel(labelId);
    return RestResponse.success();
  }
}
