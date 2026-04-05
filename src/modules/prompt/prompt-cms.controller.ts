import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiPaginatedResponse,
  ApiRestResponse,
} from '../../components/api-response.decorator';
import { PositiveIntValidationPipe } from '../../components/positive-int-validation.pipe';
import {
  AdminCreatePromptRequest,
  AdminListPromptsQuery,
  AdminUpdatePromptRequest,
  CmsPromptDetailResponse,
  CmsPromptFilesResponse,
  CmsPromptResponse,
  CmsUpdatePromptFilesPayloadRequest,
} from '../../models/admin-api.io';
import { PaginatedResponse, RestResponse } from '../../models/rest.response';
import { SwaggerBearer } from '../../models/constants';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { PromptService } from './prompt.service';

type UploadedPromptBinaryFile = {
  fieldname: string;
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@ApiTags('CMS Prompts')
@ApiExtraModels(CmsUpdatePromptFilesPayloadRequest)
@Controller('cms/prompts')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class PromptCmsController {
  constructor(private readonly promptService: PromptService) {}

  @ApiOperation({ summary: 'List prompts' })
  @ApiPaginatedResponse(CmsPromptDetailResponse)
  @Get()
  async listPrompts(@Query() query: AdminListPromptsQuery) {
    const { items, page, pageSize, total } =
      await this.promptService.listPrompts({
        page: query.page,
        pageSize: query.page_size,
        search: query.search,
      });

    const data = await Promise.all(
      items.map((item) => this.promptService.adminPromptToResponse(item)),
    );

    return PaginatedResponse.success({ data, page, pageSize, total });
  }

  @ApiOperation({ summary: 'Get prompt by id' })
  @ApiRestResponse(CmsPromptDetailResponse)
  @Get(':id')
  async getPrompt(@Param('id', PositiveIntValidationPipe) id: number) {
    const prompt = await this.promptService.getPromptById(id);
    if (!prompt) {
      return RestResponse.success();
    }

    const data = await this.promptService.adminPromptToResponse(prompt);
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Create prompt' })
  @ApiRestResponse(CmsPromptResponse)
  @Post()
  async createPrompt(@Body() input: AdminCreatePromptRequest) {
    const prompt = await this.promptService.createPrompt(input);
    return RestResponse.success(
      await this.promptService.toAdminResponseWithCategory(prompt),
    );
  }

  @ApiOperation({ summary: 'Update prompt' })
  @ApiRestResponse(CmsPromptResponse)
  @Patch(':id')
  async updatePrompt(
    @Param('id', PositiveIntValidationPipe) id: number,
    @Body() input: AdminUpdatePromptRequest,
  ) {
    const prompt = await this.promptService.updatePromptById(id, input);
    return RestResponse.success(
      await this.promptService.toAdminResponseWithCategory(prompt),
    );
  }

  @ApiOperation({ summary: 'Update prompt files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          type: 'string',
          description:
            'JSON string. Please refer to CmsUpdatePromptFilesPayloadRequest schema. For newly uploaded files, provide file_key and/or thumbnail_file_key that matches the multipart form-data field name. To keep an existing file, provide id only or omit that field entirely.',
          example: JSON.stringify(
            {
              cover: {
                id: 10,
                file_key: 'cover_file',
                thumbnail_file_key: 'cover_thumb',
              },
              pdf: {
                file_key: 'pdf_file',
              },
              media: [
                {
                  id: 21,
                  position: 0,
                },
                {
                  file_key: 'media_new_1',
                  thumbnail_file_key: 'media_new_1_thumb',
                  position: 1,
                },
              ],
              delete_ids: ['33'],
            },
            null,
            2,
          ),
        },
      },
      additionalProperties: true,
    },
  })
  @ApiRestResponse(CmsPromptFilesResponse)
  @Patch(':id/files')
  @UseInterceptors(AnyFilesInterceptor())
  async updatePromptFiles(
    @Param('id', PositiveIntValidationPipe) id: number,
    @Body('payload') payload: string,
    @UploadedFiles() files: UploadedPromptBinaryFile[] = [],
  ) {
    if (!payload) {
      throw new BadRequestException('payload is required');
    }

    const uploadedFileMap = new Map(
      files.map((file) => [
        file.fieldname,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        },
      ]),
    );

    const data = await this.promptService.updatePromptFiles(
      id,
      payload,
      uploadedFileMap,
    );
    return RestResponse.success(data);
  }
}
