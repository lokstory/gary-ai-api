import { Module } from '@nestjs/common';
import { PromptController } from './prompt.controller';
import { PromptCmsController } from './prompt-cms.controller';
import { PromptService } from './prompt.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [PromptController, PromptCmsController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
