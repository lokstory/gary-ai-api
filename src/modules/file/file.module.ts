import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileCmsController } from './file-cms.controller';
import { FileController } from './file.controller';

@Module({
  controllers: [FileCmsController, FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
