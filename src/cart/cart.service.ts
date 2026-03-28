import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderItemType } from '../models/enums';
import { PromptService } from '../prompt/prompt.service';
import { isEnumEqual } from '../utils/enum.util';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptsService: PromptService,
  ) {}

  async getCartItems(userId: bigint) {
    const items = await this.prisma.cart_items.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    const promptItems = items.filter((i) =>
      isEnumEqual(OrderItemType.PROMPT, i.item_type),
    );
    const promptIds = promptItems.map((i) => i.item_id);

    const prompts =
      promptIds.length > 0
        ? await this.prisma.prompts.findMany({
            where: { id: { in: promptIds } },
          })
        : [];

    const promptResponses = await this.promptsService.promptsToResponses(
      prompts,
      userId,
    );
    const promptResponseMap = new Map(
      prompts.map((p, i) => [p.id, promptResponses[i]]),
    );

    return items.map((item) => ({
      id: item.id.toString(),
      item_type: item.item_type,
      quantity: item.quantity,
      created_at: item.created_at,
      item: isEnumEqual(OrderItemType.PROMPT, item.item_type)
        ? (promptResponseMap.get(item.item_id) ?? null)
        : null,
    }));
  }

  async addToCart(
    userId: bigint,
    itemType: string,
    itemInternalId: bigint,
  ): Promise<{ alreadyExists: boolean }> {
    const existing = await this.prisma.cart_items.findUnique({
      where: {
        user_id_item_type_item_id: {
          user_id: userId,
          item_type: itemType,
          item_id: itemInternalId,
        },
      },
    });

    if (existing) return { alreadyExists: true };

    await this.prisma.cart_items.create({
      data: {
        user_id: userId,
        item_type: itemType,
        item_id: itemInternalId,
        quantity: 1,
      },
    });

    return { alreadyExists: false };
  }

  async removeFromCart(userId: bigint, cartItemId: bigint): Promise<boolean> {
    const item = await this.prisma.cart_items.findFirst({
      where: { id: cartItemId, user_id: userId },
    });

    if (!item) return false;

    await this.prisma.cart_items.delete({ where: { id: cartItemId } });
    return true;
  }

  async getPromptByPublicId(publicId: string) {
    return this.prisma.prompts.findFirst({ where: { uuid: publicId } });
  }
}
