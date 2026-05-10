import { Module } from '@nestjs/common';
import { AiVideoModelCmsController } from './ai-video-model-cms.controller';
import { AiVideoModelService } from './ai-video-model.service';

@Module({
  controllers: [AiVideoModelCmsController],
  providers: [AiVideoModelService],
  exports: [AiVideoModelService],
})
export class AiVideoModelModule {}
