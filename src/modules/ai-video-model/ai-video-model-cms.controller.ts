import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiRestArrayResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { PositiveIntValidationPipe } from '../../components/positive-int-validation.pipe';
import { SwaggerBearer } from '../../models/constants';
import {
  AdminListAiVideoModelsQuery,
  AdminUpdateAiVideoModelRequest,
  CmsAiVideoModelResponse,
  CmsUpdateAiVideoModelPositionsRequest,
} from '../../models/admin-api.io';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AiVideoModelService } from './ai-video-model.service';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';

@ApiTags('CMS AI Video Models')
@Controller('cms/ai-video-models')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class AiVideoModelCmsController {
  constructor(private readonly aiVideoModelService: AiVideoModelService) {}

  @ApiOperation({ summary: 'List AI video models' })
  @ApiPaginatedResponse(CmsAiVideoModelResponse)
  @Get()
  async listAiVideoModels(@Query() query: AdminListAiVideoModelsQuery) {
    const { items, total, page, pageSize } =
      await this.aiVideoModelService.listAiVideoModels({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
        provider: query.provider,
        enabled: query.enabled,
      });

    return PaginatedResponse.success({
      data: items.map((item) => this.aiVideoModelService.toResponse(item)),
      page,
      pageSize,
      total,
    });
  }

  @ApiOperation({ summary: 'List enabled AI video models' })
  @ApiRestArrayResponse(CmsAiVideoModelResponse)
  @Get('/enabled')
  async listEnabledAiVideoModels() {
    const models = await this.aiVideoModelService.listEnabledAiVideoModels();
    return RestResponse.success(
      models.map((item) => this.aiVideoModelService.toResponse(item)),
    );
  }

  @ApiOperation({ summary: 'Update AI video model positions' })
  @ApiRestArrayResponse(CmsAiVideoModelResponse)
  @Patch('positions')
  async updateAiVideoModelPositions(
    @Body() input: CmsUpdateAiVideoModelPositionsRequest,
  ) {
    const models = await this.aiVideoModelService.updateAiVideoModelPositions(
      input.items ?? [],
    );
    return RestResponse.success(
      models.map((item) => this.aiVideoModelService.toResponse(item)),
    );
  }

  @ApiOperation({ summary: 'Get AI video model by id' })
  @ApiRestResponse(CmsAiVideoModelResponse)
  @Get(':id')
  async getAiVideoModel(@Param('id', PositiveIntValidationPipe) id: number) {
    const model = await this.aiVideoModelService.getAiVideoModelById(id);
    if (!model) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return RestResponse.success(this.aiVideoModelService.toResponse(model));
  }

  @ApiOperation({ summary: 'Update AI video model settings' })
  @ApiRestResponse(CmsAiVideoModelResponse)
  @Patch(':id')
  async updateAiVideoModel(
    @Param('id', PositiveIntValidationPipe) id: number,
    @Body() input: AdminUpdateAiVideoModelRequest,
  ) {
    const model = await this.aiVideoModelService.updateAiVideoModel(id, input);
    return RestResponse.success(this.aiVideoModelService.toResponse(model));
  }
}
