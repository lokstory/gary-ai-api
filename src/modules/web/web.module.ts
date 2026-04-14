import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { LabelModule } from '../label/label.module';
import { WebController } from './web.controller';

@Module({
  imports: [CategoryModule, LabelModule],
  controllers: [WebController],
})
export class WebModule {}
