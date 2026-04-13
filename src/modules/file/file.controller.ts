import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserId } from '../../components/user-id.decorator';
import { UUIDValidationPipe } from '../../components/uuid-validation.pipe';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { SwaggerBearer } from '../../models/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileService } from './file.service';
import { FileCategory, FileType } from '../../models/enums';
import { isEnumEqual } from '../../utils/enum.util';

@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @ApiOperation({ summary: 'Download purchased prompt file by file UUID' })
  @ApiBearerAuth(SwaggerBearer.USER)
  @ApiProduces('application/pdf', 'application/zip')
  @UseGuards(JwtAuthGuard)
  @Get(':uuid')
  async downloadPromptFile(
    @Param('uuid', UUIDValidationPipe) fileUuid: string,
    @UserId() userId: bigint,
    @Res() res: Response,
  ) {
    const file = await this.fileService.getFileByUuid(fileUuid);
    if (
      !file ||
      file.ref_table !== 'prompts' ||
      !isEnumEqual(FileCategory.DOWNLOAD, file.category)
    ) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    // const purchased = await this.fileService.userOwnsPromptFile(userId, file);
    // if (!purchased) {
    //   throw new AppException({ code: AppCode.FORBIDDEN });
    // }

    const { stream, contentType } =
      await this.fileService.getStoredFileStream(file);
    const fallbackContentType = isEnumEqual(
      FileType.ZIP,
      file.file_type as FileType,
    )
      ? 'application/zip'
      : 'application/pdf';
    const extension = isEnumEqual(FileType.ZIP, file.file_type as FileType)
      ? 'zip'
      : 'pdf';

    res.setHeader('Content-Type', contentType ?? fallbackContentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.uuid}.${extension}"`,
    );

    stream.pipe(res);
  }
}
