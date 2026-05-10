import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { LabelModule } from '../label/label.module';
import { VideoSelectorModule } from '../video-selector/video-selector.module';
import { WebController } from './web.controller';

@Module({
  imports: [CategoryModule, LabelModule, VideoSelectorModule],
  controllers: [WebController],
})
export class WebModule {}
