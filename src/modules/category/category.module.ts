import { Module } from '@nestjs/common';
import { CategoryCmsController } from './category-cms.controller';
import { CategoryService } from './category.service';

@Module({
  controllers: [CategoryCmsController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
