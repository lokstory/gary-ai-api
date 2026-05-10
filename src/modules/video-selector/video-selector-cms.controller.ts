import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiEmptyRestResponse,
  ApiPaginatedResponse,
  ApiRestArrayResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { PositiveIntValidationPipe } from '../../components/positive-int-validation.pipe';
import { SwaggerBearer } from '../../models/constants';
import { VideoSelectorType } from '../../models/enums';
import {
  AdminCreateVideoSelectorRequest,
  AdminListVideoSelectorsQuery,
  AdminUpdateVideoSelectorRequest,
  CmsUpdateVideoSelectorPositionsRequest,
  CmsVideoSelectorDetailResponse,
  CmsVideoSelectorResponse,
  CmsVideoSelectorTypeThumbnailResponse,
} from '../../models/admin-api.io';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { VideoSelectorService } from './video-selector.service';

type UploadedSelectorBinaryFile = {
  fieldname: string;
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@ApiTags('CMS Video Selectors')
@Controller('cms/video-selectors')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class VideoSelectorCmsController {
  constructor(private readonly videoSelectorService: VideoSelectorService) {}

  @ApiOperation({ summary: 'List video selectors' })
  @ApiPaginatedResponse(CmsVideoSelectorResponse)
  @Get()
  async listVideoSelectors(@Query() query: AdminListVideoSelectorsQuery) {
    const { items, total, page, pageSize } =
      await this.videoSelectorService.listVideoSelectors({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
        selectorType: query.selector_type,
        enabled: query.enabled,
      });

    return PaginatedResponse.success({
      data: await Promise.all(
        items.map((item) =>
          this.videoSelectorService.toResponseWithCover(item),
        ),
      ),
      page,
      pageSize,
      total,
    });
  }

  @ApiOperation({ summary: 'Create video selector' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          type: 'string',
          description: 'JSON string for video selector fields.',
          example: JSON.stringify(
            {
              selector_type: 'STYLE',
              code: 'STYLE_001',
              prompt: 'cinematic style',
              translations: [
                { locale: 'en', name: 'Cinematic' },
                { locale: 'zh-TW', name: 'Cinematic' },
              ],
              enabled: true,
            },
            null,
            2,
          ),
        },
        cover: {
          type: 'string',
          format: 'binary',
        },
        thumbnail: {
          type: 'string',
          format: 'binary',
          description: 'STYLE only.',
        },
      },
    },
  })
  @ApiRestResponse(CmsVideoSelectorResponse)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cover', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
  )
  async createVideoSelector(
    @Body('payload') payload: string,
    @UploadedFiles()
    files: {
      cover?: UploadedSelectorBinaryFile[];
      thumbnail?: UploadedSelectorBinaryFile[];
    } = {},
  ) {
    if (!payload) {
      throw new BadRequestException('payload is required');
    }

    const selector = await this.videoSelectorService.createVideoSelector(
      this.parsePayload(payload, AdminCreateVideoSelectorRequest),
      files.cover?.[0],
      files.thumbnail?.[0],
    );
    return RestResponse.success(
      await this.videoSelectorService.toResponseWithCover(selector),
    );
  }

  @ApiOperation({ summary: 'Update video selector positions' })
  @ApiRestArrayResponse(CmsVideoSelectorResponse)
  @Patch('positions')
  async updateVideoSelectorPositions(
    @Body() input: CmsUpdateVideoSelectorPositionsRequest,
  ) {
    const selectors =
      await this.videoSelectorService.updateVideoSelectorPositions(
        input.items ?? [],
      );
    return RestResponse.success(
      await Promise.all(
        selectors.map((selector) =>
          this.videoSelectorService.toResponseWithCover(selector),
        ),
      ),
    );
  }

  @ApiOperation({ summary: 'Get video selector type global thumbnail' })
  @ApiRestResponse(CmsVideoSelectorTypeThumbnailResponse)
  @Get(':selectorType/thumbnail')
  async getTypeThumbnail(@Param('selectorType') selectorTypeParam: string) {
    const selectorType = this.parseSelectorTypeParam(selectorTypeParam);
    return RestResponse.success(
      await this.videoSelectorService.getTypeThumbnailResponse(selectorType),
    );
  }

  @ApiOperation({ summary: 'Update video selector type global thumbnail' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiRestResponse(CmsVideoSelectorTypeThumbnailResponse)
  @Patch(':selectorType/thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  async updateTypeThumbnail(
    @Param('selectorType') selectorTypeParam: string,
    @UploadedFile() file?: UploadedSelectorBinaryFile,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const selectorType = this.parseSelectorTypeParam(selectorTypeParam);
    const data = await this.videoSelectorService.updateTypeThumbnail(
      selectorType,
      file,
    );
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Delete video selector type global thumbnail' })
  @ApiEmptyRestResponse()
  @Delete(':selectorType/thumbnail')
  async deleteTypeThumbnail(@Param('selectorType') selectorTypeParam: string) {
    const selectorType = this.parseSelectorTypeParam(selectorTypeParam);
    await this.videoSelectorService.deleteTypeThumbnail(selectorType);
    return RestResponse.success();
  }

  @ApiOperation({ summary: 'Update video selector' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payload: {
          type: 'string',
          description:
            'JSON string for video selector fields. Omit when only replacing files.',
          example: JSON.stringify(
            {
              prompt: 'cinematic style',
              translations: [
                { locale: 'en', name: 'Cinematic' },
                { locale: 'zh-TW', name: 'Cinematic' },
              ],
              enabled: true,
            },
            null,
            2,
          ),
        },
        cover: {
          type: 'string',
          format: 'binary',
        },
        thumbnail: {
          type: 'string',
          format: 'binary',
          description: 'STYLE only.',
        },
      },
    },
  })
  @ApiRestResponse(CmsVideoSelectorResponse)
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cover', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
  )
  async updateVideoSelector(
    @Param('id', PositiveIntValidationPipe) id: number,
    @Body('payload') payload?: string,
    @UploadedFiles()
    files: {
      cover?: UploadedSelectorBinaryFile[];
      thumbnail?: UploadedSelectorBinaryFile[];
    } = {},
  ) {
    const cover = files.cover?.[0];
    const thumbnail = files.thumbnail?.[0];
    if (!payload && !cover && !thumbnail) {
      throw new BadRequestException('payload, cover, or thumbnail is required');
    }

    const selector = await this.videoSelectorService.updateVideoSelector(
      id,
      payload
        ? this.parsePayload(payload, AdminUpdateVideoSelectorRequest)
        : {},
      cover,
      thumbnail,
    );
    return RestResponse.success(
      await this.videoSelectorService.toResponseWithCover(selector),
    );
  }

  @ApiOperation({ summary: 'Get video selector by id' })
  @ApiRestResponse(CmsVideoSelectorDetailResponse)
  @Get(':id')
  async getVideoSelector(@Param('id', PositiveIntValidationPipe) id: number) {
    const selector = await this.videoSelectorService.getVideoSelectorById(id);
    if (!selector) {
      return RestResponse.success();
    }

    return RestResponse.success(
      await this.videoSelectorService.toDetailResponse(selector),
    );
  }

  @ApiOperation({ summary: 'Delete video selector' })
  @ApiEmptyRestResponse()
  @Delete(':id')
  async deleteVideoSelector(
    @Param('id', PositiveIntValidationPipe) id: number,
  ) {
    await this.videoSelectorService.deleteVideoSelector(id);
    return RestResponse.success();
  }

  private parseSelectorTypeParam(value: string): VideoSelectorType {
    const normalized = value.toUpperCase();
    if (
      Object.values(VideoSelectorType).includes(normalized as VideoSelectorType)
    ) {
      return normalized as VideoSelectorType;
    }

    throw new BadRequestException('selectorType is invalid');
  }

  private parsePayload<T extends object>(
    payload: string,
    target: new () => T,
  ): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException('payload must be valid JSON');
    }

    const instance = plainToInstance(target, parsed);
    const errors = validateSync(instance);
    if (errors.length) {
      throw new BadRequestException('payload is invalid');
    }

    return instance;
  }
}
