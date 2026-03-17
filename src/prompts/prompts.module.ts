import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [PromptsController],
  providers: [PromptsService],
})
export class PromptsModule {}
