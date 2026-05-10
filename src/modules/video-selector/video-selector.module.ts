import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { VideoSelectorController } from './video-selector.controller';
import { VideoSelectorCmsController } from './video-selector-cms.controller';
import { VideoSelectorService } from './video-selector.service';

@Module({
  imports: [FileModule],
  controllers: [VideoSelectorController, VideoSelectorCmsController],
  providers: [VideoSelectorService],
  exports: [VideoSelectorService],
})
export class VideoSelectorModule {}
