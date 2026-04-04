import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { SwaggerBearer } from '../../models/constants';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { FileService } from './file.service';
import { RestResponse } from '../../models/rest.response';
import { ApiRestResponse } from '../../components/api-response.decorator';
import { AdminTestUploadResponse } from '../../models/admin-api.io';

type UploadedBinaryFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@ApiTags('CMS Files')
@Controller('cms/files')
@ApiBearerAuth(SwaggerBearer.ADMIN)
@UseGuards(AdminJwtAuthGuard)
export class FileCmsController {
  constructor(private readonly fileService: FileService) {}

  @ApiOperation({ summary: 'Test upload file to public bucket' })
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
  @ApiRestResponse(AdminTestUploadResponse)
  @Post('test-upload/public')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPublicFile(@UploadedFile() file?: UploadedBinaryFile) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const data = await this.fileService.uploadTestFile(file, 'public');
    return RestResponse.success(data);
  }

  @ApiOperation({ summary: 'Test upload file to private bucket' })
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
  @ApiRestResponse(AdminTestUploadResponse)
  @Post('test-upload/private')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPrivateFile(@UploadedFile() file?: UploadedBinaryFile) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const data = await this.fileService.uploadTestFile(file, 'private');
    return RestResponse.success(data);
  }
}
