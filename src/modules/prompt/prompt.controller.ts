import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ApiEmptyRestResponse,
  ApiPaginatedResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { UserId } from '../../components/user-id.decorator';
import { UUIDValidationPipe } from '../../components/uuid-validation.pipe';
import { AppCode } from '../../models/app.code';
import { AppException } from '../../models/app.exception';
import { SwaggerBearer } from '../../models/constants';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import {
  ListPromptsQuery,
  PageQuery,
  PromptResponse,
} from '../../models/user-api.io';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PromptService } from './prompt.service';

@Controller('prompts')
export class PromptController {
  constructor(private readonly promptsService: PromptService) {}

  @ApiOperation({ summary: 'List prompts' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiPaginatedResponse(PromptResponse)
  @Get()
  async listPrompts(
    @Query() query: ListPromptsQuery,
    @UserId() userId: bigint | null,
  ) {
    const { items, page, pageSize, total } =
      await this.promptsService.listPrompts({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
      });

    const data = await this.promptsService.promptsToResponses(items, userId);

    return PaginatedResponse.success({ data, page, pageSize, total });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SwaggerBearer.USER)
  @ApiOperation({ summary: 'List user favorite prompts' })
  @ApiPaginatedResponse(PromptResponse)
  @Get('/favorites')
  async listFavorites(@UserId() userId: bigint, @Query() query: PageQuery) {
    const { items, total } = await this.promptsService.listFavoritePrompts(
      userId,
      query,
    );

    const data = await this.promptsService.promptsToResponses(items, userId);

    return PaginatedResponse.success({
      data,
      page: query.page,
      pageSize: query.page_size,
      total,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SwaggerBearer.USER)
  @ApiOperation({ summary: 'List user purchased prompts' })
  @ApiPaginatedResponse(PromptResponse)
  @Get('/purchased')
  async listPurchased(@UserId() userId: bigint, @Query() query: PageQuery) {
    const { items, total } = await this.promptsService.listPurchasedPrompts(
      userId,
      query,
    );

    const data = await this.promptsService.promptsToResponses(items, userId);

    return PaginatedResponse.success({
      data,
      page: query.page,
      pageSize: query.page_size,
      total,
    });
  }

  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @ApiEmptyRestResponse()
  @Post(':uuid/favorite')
  async addFavorite(
    @Param('uuid', UUIDValidationPipe) publicId: string,
    @UserId() userId: bigint,
  ) {
    const prompt = await this.promptsService.getPromptByPublicId(publicId);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.promptsService.addFavorite(userId, prompt.id);

    return RestResponse.success();
  }

  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(JwtAuthGuard)
  @ApiEmptyRestResponse()
  @Delete(':uuid/favorite')
  async removeFavorite(
    @Param('uuid', UUIDValidationPipe) publicId: string,
    @UserId() userId: bigint,
  ) {
    const prompt = await this.promptsService.getPromptByPublicId(publicId);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    await this.promptsService.removeFavorite(userId, prompt.id);

    return RestResponse.success();
  }

  @Get(':uuid')
  @ApiBearerAuth(SwaggerBearer.USER)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get prompt by UUID' })
  @ApiRestResponse(PromptResponse)
  async getPrompt(
    @Param('uuid', UUIDValidationPipe) publicId: string,
    @UserId() userId: bigint | null,
  ) {
    const prompt = await this.promptsService.getPromptByPublicId(publicId);
    if (!prompt) return RestResponse.success();

    const [data] = await this.promptsService.promptsToResponses(
      [prompt],
      userId,
    );

    return RestResponse.success(data);
  }
}
