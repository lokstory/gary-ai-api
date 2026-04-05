import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { createHash } from 'crypto';
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
import { OrderResponse, PageQuery } from '../../models/user-api.io';
import { isEnumEqual } from '../../utils/enum.util';

type CheckoutLineItem = {
  item_type: string;
  item_id: bigint;
  quantity: number;
  unit_price: number;
  amount: number;
  name: string;
};

type CheckoutDbClient = PrismaService | Prisma.TransactionClient;

type PendingCheckoutRow = {
  order_id: bigint;
  order_uuid: string;
  payment_id: bigint;
  checkout_url: string | null;
  expires_at: Date | null;
  provider_session_id: string | null;
};

type OrderWithRelations = Awaited<
  ReturnType<OrderService['findOrderRecordByUuid']>
>;

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private static readonly REUSE_CHECKOUT_WINDOW_MS = 60 * 60 * 1000;
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  onModuleInit() {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'));
  }

  async checkoutFromCart(userId: bigint): Promise<OrderResponse> {
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

    return this.checkout(userId, lineItems);
  }

  async checkoutDirect(
    userId: bigint,
    itemType: string,
    itemId: bigint,
  ): Promise<OrderResponse | null> {
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

    return this.checkout(userId, lineItems);
  }

  private async checkout(
    userId: bigint,
    lineItems: CheckoutLineItem[],
  ): Promise<OrderResponse> {
    const fingerprint = this.buildLineItemsFingerprint(lineItems);
    const now = new Date();
    const totalAmount = this.calculateTotalAmount(lineItems);

    const prepared = await this.prisma.$transaction(async (tx) => {
      await this.acquireCheckoutLock(tx, userId, fingerprint);
      await this.ensurePromptsNotPurchased(tx, userId, lineItems);

      const existingCheckout = await this.findReusableCheckout(
        tx,
        userId,
        fingerprint,
        now,
      );
      if (existingCheckout) {
        return {
          type: 'reuse' as const,
          orderUuid: existingCheckout.order_uuid,
        };
      }

      const staleSessionIds = await this.cancelPendingCheckouts(
        tx,
        userId,
        fingerprint,
        now,
      );
      const order = await this.createPendingOrder(
        tx,
        userId,
        fingerprint,
        lineItems,
        totalAmount,
      );

      return {
        type: 'create' as const,
        order,
        staleSessionIds,
      };
    });

    if (prepared.type === 'reuse') {
      return this.getOrderByUuidOrThrow(userId, prepared.orderUuid);
    }

    await this.expireStripeSessions(prepared.staleSessionIds);

    const createdOrder = await this.createStripeCheckout(
      prepared.order,
      lineItems,
    );
    return this.getOrderByUuidOrThrow(userId, createdOrder.uuid);
  }

  private async acquireCheckoutLock(
    tx: Prisma.TransactionClient,
    userId: bigint,
    fingerprint: string,
  ) {
    const userLockKey = this.hashLockKey(userId.toString());
    const fingerprintLockKey = this.hashLockKey(fingerprint);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userLockKey}, ${fingerprintLockKey})`;
  }

  private hashLockKey(input: string): number {
    let hash = 0;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }

    return hash;
  }

  private buildLineItemsFingerprint(lineItems: CheckoutLineItem[]): string {
    const rawFingerprint = [...lineItems]
      .sort((a, b) => {
        if (a.item_type !== b.item_type) {
          return a.item_type.localeCompare(b.item_type);
        }

        if (a.item_id === b.item_id) {
          return a.quantity - b.quantity;
        }

        return a.item_id < b.item_id ? -1 : 1;
      })
      .map(
        (item) =>
          `${item.item_type}:${item.item_id.toString()}:${item.quantity}`,
      )
      .join(';');

    return createHash('sha256').update(rawFingerprint).digest('hex');
  }

  private calculateTotalAmount(lineItems: CheckoutLineItem[]) {
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  }

  private async ensurePromptsNotPurchased(
    db: CheckoutDbClient,
    userId: bigint,
    lineItems: CheckoutLineItem[],
  ) {
    const promptIds = lineItems
      .filter((item) => isEnumEqual(OrderItemType.PROMPT, item.item_type))
      .map((item) => item.item_id);

    if (!promptIds.length) return;

    const existing = await db.user_prompts.findFirst({
      where: { user_id: userId, prompt_id: { in: promptIds } },
    });

    if (existing) {
      throw new AppException({ code: AppCode.ORDER_ITEM_ALREADY_PURCHASED });
    }
  }

  private async findReusableCheckout(
    db: CheckoutDbClient,
    userId: bigint,
    fingerprint: string,
    now: Date,
  ): Promise<PendingCheckoutRow | null> {
    const pendingCheckouts = await this.findPendingCheckoutsByFingerprint(
      db,
      userId,
      fingerprint,
    );

    for (const checkout of pendingCheckouts) {
      if (!checkout.checkout_url || !checkout.expires_at) {
        continue;
      }

      if (!this.hasReusableCheckoutWindow(checkout.expires_at, now)) {
        continue;
      }

      return {
        ...checkout,
      };
    }

    return null;
  }

  private hasReusableCheckoutWindow(expiresAt: Date, now: Date) {
    return (
      expiresAt.getTime() - now.getTime() >=
      OrderService.REUSE_CHECKOUT_WINDOW_MS
    );
  }

  private isPaymentExpired(expiresAt: Date | null, now: Date) {
    return !expiresAt || expiresAt.getTime() <= now.getTime();
  }

  private async cancelPendingCheckouts(
    tx: Prisma.TransactionClient,
    userId: bigint,
    fingerprint: string,
    now: Date,
  ) {
    const stalePayments = (
      await this.findPendingCheckoutsByFingerprint(tx, userId, fingerprint)
    )
      .filter(
        (checkout) =>
          checkout.expires_at &&
          !this.hasReusableCheckoutWindow(checkout.expires_at, now),
      )
      .map((checkout) => ({
        paymentId: checkout.payment_id,
        orderId: checkout.order_id,
        sessionId: checkout.provider_session_id,
      }));

    if (!stalePayments.length) {
      return [];
    }

    await tx.payments.updateMany({
      where: { id: { in: stalePayments.map((item) => item.paymentId) } },
      data: { status: PaymentStatus.CANCELLED },
    });

    await tx.orders.updateMany({
      where: { id: { in: stalePayments.map((item) => item.orderId) } },
      data: { status: OrderStatus.CANCELLED },
    });

    return stalePayments
      .map((item) => item.sessionId)
      .filter((item): item is string => Boolean(item));
  }

  private async expireStripeSessions(sessionIds: string[]) {
    for (const sessionId of sessionIds) {
      try {
        await this.stripe.checkout.sessions.expire(sessionId);
      } catch (error) {
        this.logger.warn(
          `Failed to expire Stripe session ${sessionId}: ${error.message}`,
        );
      }
    }
  }

  private async createPendingOrder(
    tx: Prisma.TransactionClient,
    userId: bigint,
    fingerprint: string,
    lineItems: CheckoutLineItem[],
    totalAmount: number,
  ) {
    const order = await tx.orders.create({
      data: {
        user_id: userId,
        status: OrderStatus.PENDING,
        amount: totalAmount,
        currency: 'TWD',
      },
    });

    await tx.$executeRaw`
      UPDATE orders
      SET fingerprint = ${fingerprint}
      WHERE id = ${order.id}
    `;

    await tx.order_items.createMany({
      data: lineItems.map((item) => ({
        order_id: order.id,
        item_type: item.item_type,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    });

    return order;
  }

  private async findPendingCheckoutsByFingerprint(
    db: CheckoutDbClient,
    userId: bigint,
    fingerprint: string,
  ): Promise<PendingCheckoutRow[]> {
    return db.$queryRaw<PendingCheckoutRow[]>`
      SELECT
        o.id AS order_id,
        o.uuid AS order_uuid,
        p.id AS payment_id,
        p.checkout_url,
        p.expires_at,
        p.provider_session_id
      FROM orders o
      JOIN LATERAL (
        SELECT
          id,
          checkout_url,
          expires_at,
          provider_session_id
        FROM payments
        WHERE order_id = o.id
          AND provider = ${PaymentProvider.STRIPE}
          AND status = ${PaymentStatus.PENDING}
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      WHERE o.user_id = ${userId}
        AND o.status = ${OrderStatus.PENDING}
        AND o.fingerprint = ${fingerprint}
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
  }

  private async createStripeCheckout(
    order: { id: bigint; uuid: string },
    lineItems: CheckoutLineItem[],
  ): Promise<{ id: bigint; uuid: string }> {
    const successUrl = this.config.getOrThrow<string>('STRIPE_SUCCESS_URL');
    const cancelUrl = this.config.getOrThrow<string>('STRIPE_CANCEL_URL');
    const stripeItems = lineItems.map((item) => ({
      price_data: {
        currency: 'twd',
        unit_amount: item.unit_price * 100,
        product_data: { name: item.name },
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: stripeItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const payment = await this.prisma.payments.create({
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

    return order;
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
      where: { order_id: payment.order_id },
    });
    const promptOrderItems = orderItems.filter((item) =>
      isEnumEqual(OrderItemType.PROMPT, item.item_type),
    );
    const itemsByType = orderItems.reduce<Record<string, typeof orderItems>>(
      (acc, item) => {
        (acc[item.item_type] ??= []).push(item);
        return acc;
      },
      {},
    );

    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, raw_payload: session as object },
      }),
      this.prisma.orders.update({
        where: { id: payment.order_id },
        data: { status: OrderStatus.PAID },
      }),
      ...(promptOrderItems.length
        ? [
            this.prisma.user_prompts.createMany({
              data: promptOrderItems.map((item) => ({
                user_id: payment.orders.user_id,
                prompt_id: item.item_id,
                order_id: payment.order_id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...Object.entries(itemsByType).map(([itemType, items]) =>
        this.prisma.cart_items.deleteMany({
          where: {
            user_id: payment.orders.user_id,
            item_type: itemType,
            item_id: { in: items.map((item) => item.item_id) },
          },
        }),
      ),
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
        include: {
          order_items: true,
          payments: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        skip,
        take,
      }),
      this.prisma.orders.count({ where: { user_id: userId } }),
    ]);

    const items = await this.toOrderResponses(orders, userId);

    return { items, total };
  }

  async getOrderByUuid(
    userId: bigint,
    uuid: string,
  ): Promise<OrderResponse | null> {
    const order = await this.findOrderRecordByUuid(userId, uuid);
    if (!order) return null;

    const [response] = await this.toOrderResponses([order], userId);
    return response ?? null;
  }

  private async getOrderByUuidOrThrow(userId: bigint, uuid: string) {
    const order = await this.getOrderByUuid(userId, uuid);
    if (!order) {
      throw new AppException({ code: AppCode.NOT_FOUND });
    }

    return order;
  }

  private async findOrderRecordByUuid(userId: bigint, uuid: string) {
    return this.prisma.orders.findFirst({
      where: { user_id: userId, uuid },
      include: {
        order_items: true,
        payments: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });
  }

  private async toOrderResponses(
    orders: NonNullable<OrderWithRelations>[],
    userId: bigint,
  ): Promise<OrderResponse[]> {
    const promptIds = orders
      .flatMap((order) => order.order_items)
      .filter((item) => isEnumEqual(OrderItemType.PROMPT, item.item_type))
      .map((item) => item.item_id);

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
      prompts.map((prompt, index) => [prompt.id, promptResponses[index]]),
    );

    return orders.map((order) => {
      const payment = order.payments[0] ?? null;
      const now = new Date();
      const orderPayment =
        payment && isEnumEqual(OrderStatus.PENDING, order.status)
          ? {
              expires_at: payment.expires_at,
              checkout_url: this.isPaymentExpired(payment.expires_at, now)
                ? null
                : payment.checkout_url,
            }
          : null;

      return {
        uuid: order.uuid,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        created_at: order.created_at,
        payment: orderPayment,
        items: order.order_items.map((item) => ({
          item_type: item.item_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          item: isEnumEqual(OrderItemType.PROMPT, item.item_type)
            ? (promptResponseMap.get(item.item_id) ?? null)
            : null,
        })),
      };
    });
  }

  async getPromptByPublicId(publicId: string) {
    return this.prisma.prompts.findFirst({ where: { uuid: publicId } });
  }
}
