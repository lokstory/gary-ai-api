import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderItemType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '../../models/enums';
import Stripe from 'stripe';
import { AppException } from '../../models/app.exception';
import { AppCode } from '../../models/app.code';
import { PromptService } from '../prompt/prompt.service';
import { PageQuery } from '../../models/user-api.io';
import { isEnumEqual } from '../../utils/enum.util';

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  onModuleInit() {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'));
  }

  async checkoutFromCart(userId: bigint): Promise<{ checkout_url: string }> {
    const cartItems = await this.prisma.cart_items.findMany({
      where: { user_id: userId },
    });

    if (!cartItems.length) {
      throw new AppException({ code: AppCode.ORDER_CART_EMPTY });
    }

    const promptItems = cartItems.filter((i) =>
      isEnumEqual(OrderItemType.PROMPT, i.item_type),
    );
    const promptIds = promptItems.map((i) => i.item_id);

    const prompts =
      promptIds.length > 0
        ? await this.prisma.prompts.findMany({
            where: { id: { in: promptIds } },
          })
        : [];

    const promptMap = new Map(prompts.map((p) => [p.id, p]));

    const lineItems = cartItems
      .map((item) => {
        if (isEnumEqual(OrderItemType.PROMPT, item.item_type)) {
          const prompt = promptMap.get(item.item_id);
          return {
            item_type: item.item_type,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: prompt?.price ?? 0,
            amount: (prompt?.price ?? 0) * item.quantity,
            name: prompt?.name ?? '',
          };
        }
        return null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    const totalAmount = lineItems.reduce((sum, i) => sum + i.amount, 0);

    return this._createOrderAndSession(userId, lineItems, totalAmount);
  }

  async checkoutDirect(
    userId: bigint,
    itemType: string,
    itemId: bigint,
  ): Promise<{ checkout_url: string } | null> {
    let name = '';
    let unitPrice = 0;

    if (isEnumEqual(OrderItemType.PROMPT, itemType)) {
      const prompt = await this.prisma.prompts.findUnique({
        where: { id: itemId },
      });
      if (!prompt) return null;
      name = prompt.name;
      unitPrice = prompt.price;
    } else {
      return null;
    }

    const lineItems = [
      {
        item_type: itemType,
        item_id: itemId,
        quantity: 1,
        unit_price: unitPrice,
        amount: unitPrice,
        name,
      },
    ];

    return this._createOrderAndSession(userId, lineItems, unitPrice);
  }

  private async _createOrderAndSession(
    userId: bigint,
    lineItems: {
      item_type: string;
      item_id: bigint;
      quantity: number;
      unit_price: number;
      amount: number;
      name: string;
    }[],
    totalAmount: number,
  ): Promise<{ checkout_url: string }> {
    const promptIds = lineItems
      .filter((i) => isEnumEqual(OrderItemType.PROMPT, i.item_type))
      .map((i) => i.item_id);

    if (promptIds.length) {
      const existing = await this.prisma.user_prompts.findFirst({
        where: { user_id: userId, prompt_id: { in: promptIds } },
      });
      if (existing) {
        throw new AppException({ code: AppCode.ORDER_ITEM_ALREADY_PURCHASED });
      }
    }

    const successUrl = this.config.getOrThrow<string>('STRIPE_SUCCESS_URL');
    const cancelUrl = this.config.getOrThrow<string>('STRIPE_CANCEL_URL');

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.orders.create({
        data: {
          user_id: userId,
          status: OrderStatus.PENDING,
          amount: totalAmount,
          currency: 'TWD',
        },
      });

      await tx.order_items.createMany({
        data: lineItems.map((i) => ({
          order_id: newOrder.id,
          item_type: i.item_type,
          item_id: i.item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          amount: i.amount,
        })),
      });

      const itemsByType = lineItems.reduce<Record<string, typeof lineItems>>(
        (acc, i) => {
          (acc[i.item_type] ??= []).push(i);
          return acc;
        },
        {},
      );
      for (const [itemType, items] of Object.entries(itemsByType)) {
        await tx.cart_items.deleteMany({
          where: {
            user_id: userId,
            item_type: itemType,
            item_id: { in: items.map((i) => i.item_id) },
          },
        });
      }

      return newOrder;
    });

    const stripeItems = lineItems.map((i) => ({
      price_data: {
        currency: 'twd',
        unit_amount: i.unit_price * 100,
        product_data: { name: i.name },
      },
      quantity: i.quantity,
    }));

    console.log('stripe items');
    console.log(stripeItems);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: stripeItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await this.prisma.payments.create({
      data: {
        order_id: order.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        provider_payment_id: (session.payment_intent as string) ?? session.id,
        provider_session_id: session.id,
        checkout_url: session.url,
        expires_at: session.expires_at
          ? new Date(session.expires_at * 1000)
          : null,
      },
    });

    return { checkout_url: session.url! };
  }

  async handleStripeWebhook(rawBody: Buffer, sig: string): Promise<void> {
    const webhookSecret: string = this.config.getOrThrow(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${err.message}`,
      );
      throw new AppException({ code: AppCode.PARAMETER_ERROR });
    }

    this.logger.log(`Stripe webhook received: ${event.type} [${event.id}]`);

    switch (event.type) {
      case 'checkout.session.completed': {
        await this._onSessionCompleted(event.data.object);
        break;
      }
      case 'checkout.session.expired': {
        await this._onSessionExpired(event.data.object);
        break;
      }
    }
  }

  private async _onSessionCompleted(session: Stripe.Checkout.Session) {
    const payment = await this.prisma.payments.findFirst({
      where: { provider_session_id: session.id },
      include: { orders: true },
    });
    if (!payment) {
      this.logger.warn(
        `_onSessionCompleted: payment not found for session ${session.id}`,
      );
      return;
    }

    if (isEnumEqual(PaymentStatus.PAID, payment.status)) {
      this.logger.warn(
        `_onSessionCompleted: already processed, skipping (payment: ${payment.id})`,
      );
      return;
    }

    const orderItems = await this.prisma.order_items.findMany({
      where: { order_id: payment.order_id, item_type: OrderItemType.PROMPT },
    });

    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, raw_payload: session as object },
      }),
      this.prisma.orders.update({
        where: { id: payment.order_id },
        data: { status: OrderStatus.PAID },
      }),
      this.prisma.user_prompts.createMany({
        data: orderItems.map((item) => ({
          user_id: payment.orders.user_id,
          prompt_id: item.item_id,
          order_id: payment.order_id,
        })),
        skipDuplicates: true,
      }),
    ]);

    this.logger.log(
      `Order ${payment.order_id} marked as PAID (session: ${session.id})`,
    );
  }

  private async _onSessionExpired(session: Stripe.Checkout.Session) {
    const payment = await this.prisma.payments.findFirst({
      where: { provider_session_id: session.id },
    });
    if (!payment) {
      this.logger.warn(
        `_onSessionExpired: payment not found for session ${session.id}`,
      );
      return;
    }

    if (isEnumEqual(PaymentStatus.EXPIRED, payment.status)) {
      this.logger.warn(
        `_onSessionExpired: already processed, skipping (payment: ${payment.id})`,
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.EXPIRED, raw_payload: session as object },
      }),
      this.prisma.orders.update({
        where: { id: payment.order_id },
        data: { status: OrderStatus.CANCELLED },
      }),
    ]);

    this.logger.log(
      `Order ${payment.order_id} cancelled due to session expiry (session: ${session.id})`,
    );
  }

  async listOrders(userId: bigint, options: PageQuery) {
    const skip = (options.page - 1) * options.page_size;
    const take = options.page_size;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.orders.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: { order_items: true },
        skip,
        take,
      }),
      this.prisma.orders.count({ where: { user_id: userId } }),
    ]);

    const promptIds = orders
      .flatMap((o) => o.order_items)
      .filter((i) => isEnumEqual(OrderItemType.PROMPT, i.item_type))
      .map((i) => i.item_id);

    const prompts =
      promptIds.length > 0
        ? await this.prisma.prompts.findMany({
            where: { id: { in: promptIds } },
          })
        : [];

    const promptResponses = await this.promptService.promptsToResponses(
      prompts,
      userId,
    );
    const promptResponseMap = new Map(
      prompts.map((p, i) => [p.id, promptResponses[i]]),
    );

    const items = orders.map((order) => ({
      uuid: order.uuid,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      created_at: order.created_at,
      items: order.order_items.map((item) => ({
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        item: isEnumEqual(OrderItemType.PROMPT, item.item_type)
          ? (promptResponseMap.get(item.item_id) ?? null)
          : null,
      })),
    }));

    return { items, total };
  }

  async getPromptByPublicId(publicId: string) {
    return this.prisma.prompts.findFirst({ where: { uuid: publicId } });
  }
}
