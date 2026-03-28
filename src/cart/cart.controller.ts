import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../components/user-id.decorator';
import { RestResponse } from '../models/rest.response';
import { SwaggerBearer } from '../models/constants';
import { AppException } from '../models/app.exception';
import { AppCode } from '../models/app.code';
import { OrderItemType } from '../models/enums';
import { UUIDValidationPipe } from '../components/uuid-validation.pipe';
import { stringToBigInt } from '../utils/number.util';

@ApiBearerAuth(SwaggerBearer.USER)
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Get cart items' })
  @Get()
  async getCartItems(@UserId() userId: bigint) {
    const items = await this.cartService.getCartItems(userId);
    return RestResponse.success(items);
  }

  @ApiOperation({ summary: 'Add prompt to cart by prompt UUID' })
  @Post('prompts/:uuid')
  async addPromptToCart(
    @UserId() userId: bigint,
    @Param('uuid', UUIDValidationPipe) uuid: string,
  ) {
    const prompt = await this.cartService.getPromptByPublicId(uuid);
    if (!prompt) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    const { alreadyExists } = await this.cartService.addToCart(
      userId,
      OrderItemType.PROMPT,
      prompt.id,
    );

    if (alreadyExists) {
      throw new AppException({ code: AppCode.CART_ITEM_ALREADY_EXISTS });
    }

    return RestResponse.success();
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @Delete(':id')
  async removeFromCart(@UserId() userId: bigint, @Param('id') id: string) {
    const itemId: bigint | null = stringToBigInt(id);
    if (!itemId) {
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    const removed = await this.cartService.removeFromCart(userId, itemId);
    if (!removed) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }
    return RestResponse.success();
  }
}
