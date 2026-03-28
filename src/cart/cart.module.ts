import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [PromptModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
