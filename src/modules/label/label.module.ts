import { Module } from '@nestjs/common';
import { LabelCmsController } from './label-cms.controller';
import { LabelService } from './label.service';

@Module({
  controllers: [LabelCmsController],
  providers: [LabelService],
  exports: [LabelService],
})
export class LabelModule {}
