import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { QueryMode } from '../../../generated/prisma/internal/prismaNamespace';
import { createHash, randomBytes } from 'crypto';
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
import { CmsOrderResponse } from '../../models/admin-api.io';

type CheckoutLineItem = {
  item_type: string;
  item_id: bigint;
  quantity: number;
  unit_price: number;
  amount: number;
  name: string;
};

type CheckoutDbClient = PrismaService | Prisma.TransactionClient;

type StripePaymentRecord = {
  id: bigint;
  order_id: bigint;
  status: string;
  updated_at: Date;
  raw_payload: unknown;
  orders: {
    user_id: bigint;
    status: string;
  };
};

type PendingOrderRecord = {
  id: bigint;
  uuid: string;
  display_id: string;
  user_id: bigint;
  status: string;
  amount: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
  fingerprint: string | null;
};

type OrderWithRelations = Awaited<
  ReturnType<OrderService['findOrderRecordByUuid']>
>;

type AdminOrderWithRelations = Awaited<
  ReturnType<OrderService['findAdminOrderRecords']>
>[number];

type AdminListOrdersOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderUuid?: string;
  displayId?: string;
  status?: OrderStatus;
  userUuid?: string;
};

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private static readonly CHECKOUT_SESSION_SYNC_WINDOW_MS = 15 * 1000;
  private static readonly DISPLAY_ID_CREATE_ATTEMPTS = 5;
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  onModuleInit() {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'));
  }

  async checkoutFromCart(
    userId: bigint,
    locale: string,
  ): Promise<OrderResponse> {
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
            include: {
              prompt_translations: {
                where: { locale },
                take: 1,
              },
            },
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
            name: prompt?.prompt_translations[0]?.name ?? '',
          };
        }
        return null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    return this.checkout(userId, lineItems, locale);
  }

  async checkoutDirect(
    userId: bigint,
    itemType: string,
    itemId: bigint,
    locale: string,
  ): Promise<OrderResponse | null> {
    let name = '';
    let unitPrice = 0;

    if (isEnumEqual(OrderItemType.PROMPT, itemType)) {
      const prompt = await this.prisma.prompts.findUnique({
        where: { id: itemId },
        include: {
          prompt_translations: {
            where: { locale },
            take: 1,
          },
        },
      });
      if (!prompt) return null;
      name = prompt.prompt_translations[0]?.name ?? '';
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

    return this.checkout(userId, lineItems, locale);
  }

  private async checkout(
    userId: bigint,
    lineItems: CheckoutLineItem[],
    locale: string,
  ): Promise<OrderResponse> {
    const fingerprint = this.buildLineItemsFingerprint(lineItems);
    const totalAmount = this.calculateTotalAmount(lineItems);

    const prepared = await this.prisma.$transaction(async (tx) => {
      await this.acquireCheckoutLock(tx, userId, fingerprint);
      await this.ensurePromptsNotPurchased(tx, userId, lineItems);

      const order = await this.createPendingOrder(
        tx,
        userId,
        fingerprint,
        lineItems,
        totalAmount,
      );

      return {
        order,
      };
    });

    const createdOrder = await this.createStripeCheckout(
      prepared.order,
      lineItems,
    );
    return this.getOrderByUuidOrThrow(userId, createdOrder.uuid, locale);
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

  private isPaymentExpired(expiresAt: Date | null, now: Date) {
    return !expiresAt || expiresAt.getTime() <= now.getTime();
  }

  private async createPendingOrder(
    tx: Prisma.TransactionClient,
    userId: bigint,
    fingerprint: string,
    lineItems: CheckoutLineItem[],
    totalAmount: number,
  ) {
    const order = await this.createOrderRecordWithDisplayId(
      tx,
      userId,
      totalAmount,
    );

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

  private async createOrderRecordWithDisplayId(
    tx: Prisma.TransactionClient,
    userId: bigint,
    totalAmount: number,
  ) {
    for (
      let attempt = 1;
      attempt <= OrderService.DISPLAY_ID_CREATE_ATTEMPTS;
      attempt += 1
    ) {
      const [order] = await tx.$queryRaw<PendingOrderRecord[]>`
        INSERT INTO orders (display_id, user_id, status, amount, currency)
        VALUES (
          ${this.generateOrderDisplayId()},
          ${userId},
          ${OrderStatus.PENDING},
          ${totalAmount},
          'TWD'
        )
        ON CONFLICT (display_id) DO NOTHING
        RETURNING id, uuid, display_id, user_id, status, amount, currency, created_at, updated_at, fingerprint
      `;

      if (order) {
        return order;
      }
    }

    throw new Error('Failed to generate a unique order display_id');
  }

  private async createStripeCheckout(
    order: { id: bigint; uuid: string },
    lineItems: CheckoutLineItem[],
  ): Promise<{ id: bigint; uuid: string }> {
    const successUrl = this.buildStripeSuccessUrl(
      this.config.getOrThrow<string>('STRIPE_SUCCESS_URL'),
      order.uuid,
    );
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
      client_reference_id: order.uuid,
      payment_intent_data: {
        metadata: {
          order_id: order.id.toString(),
          order_uuid: order.uuid,
        },
      },
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

  private buildStripeSuccessUrl(successUrl: string, orderUuid: string) {
    const checkoutSessionIdTemplate = '{CHECKOUT_SESSION_ID}';
    const url = new URL(successUrl);

    url.searchParams.set('session_id', checkoutSessionIdTemplate);
    url.searchParams.set('order_uuid', orderUuid);

    return url
      .toString()
      .replace(
        encodeURIComponent(checkoutSessionIdTemplate),
        checkoutSessionIdTemplate,
      );
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
        await this._onSessionCompleted(event.data.object, event.type);
        break;
      }
      case 'checkout.session.expired': {
        await this._onSessionExpired(event.data.object, event.type);
        break;
      }
      case 'payment_intent.succeeded': {
        await this._onPaymentIntentSucceeded(event.data.object, event.type);
        break;
      }
      case 'payment_intent.payment_failed': {
        await this._onPaymentIntentFailed(event.data.object, event.type);
        break;
      }
    }
  }

  private async _onSessionCompleted(
    session: Stripe.Checkout.Session,
    eventType = 'checkout.session.completed',
  ) {
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

    if (
      isEnumEqual(PaymentStatus.PAID, payment.status) &&
      isEnumEqual(OrderStatus.PAID, payment.orders.status)
    ) {
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
        data: {
          status: PaymentStatus.PAID,
          provider_payment_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : payment.provider_payment_id,
          raw_payload: this.buildPaymentRawPayload(
            payment.raw_payload,
            eventType,
            session,
          ),
        },
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

  private async _onSessionExpired(
    session: Stripe.Checkout.Session,
    eventType = 'checkout.session.expired',
  ) {
    const payment = await this.prisma.payments.findFirst({
      where: { provider_session_id: session.id },
      include: { orders: true },
    });
    if (!payment) {
      this.logger.warn(
        `_onSessionExpired: payment not found for session ${session.id}`,
      );
      return;
    }

    if (isEnumEqual(PaymentStatus.PAID, payment.status)) {
      this.logger.warn(
        `_onSessionExpired: payment already PAID, skipping (payment: ${payment.id})`,
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.EXPIRED,
          raw_payload: this.buildPaymentRawPayload(
            payment.raw_payload,
            eventType,
            session,
          ),
        },
      }),
      this.prisma.orders.update({
        where: { id: payment.order_id },
        data: { status: OrderStatus.FAILED },
      }),
    ]);

    this.logger.log(
      `Order ${payment.order_id} marked as FAILED due to session expiry (session: ${session.id})`,
    );
  }

  private async _onPaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    eventType = 'payment_intent.succeeded',
  ) {
    const payment = await this.findPaymentByPaymentIntent(paymentIntent);
    if (!payment) {
      this.logger.warn(
        `_onPaymentIntentSucceeded: payment not found for intent ${paymentIntent.id}`,
      );
      return;
    }

    if (
      isEnumEqual(PaymentStatus.PAID, payment.status) &&
      isEnumEqual(OrderStatus.PAID, payment.orders.status)
    ) {
      this.logger.warn(
        `_onPaymentIntentSucceeded: already processed, skipping (payment: ${payment.id})`,
      );
      return;
    }

    await this.markPaymentPaid(payment, paymentIntent, eventType);
  }

  private async _onPaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
    eventType = 'payment_intent.payment_failed',
  ) {
    const payment = await this.findPaymentByPaymentIntent(paymentIntent);
    if (!payment) {
      this.logger.warn(
        `_onPaymentIntentFailed: payment not found for intent ${paymentIntent.id}`,
      );
      return;
    }

    if (isEnumEqual(PaymentStatus.PAID, payment.status)) {
      this.logger.warn(
        `_onPaymentIntentFailed: payment already PAID, skipping (payment: ${payment.id})`,
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          provider_payment_id: paymentIntent.id,
          raw_payload: this.buildPaymentRawPayload(
            payment.raw_payload,
            eventType,
            paymentIntent,
          ),
        },
      }),
      this.prisma.orders.update({
        where: { id: payment.order_id },
        data: { status: OrderStatus.FAILED },
      }),
    ]);

    this.logger.log(
      `Order ${payment.order_id} marked as FAILED (payment intent: ${paymentIntent.id})`,
    );
  }

  private async findPaymentByPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<StripePaymentRecord | null> {
    const payment = await this.prisma.payments.findFirst({
      where: {
        provider: PaymentProvider.STRIPE,
        provider_payment_id: paymentIntent.id,
      },
      include: { orders: { select: { user_id: true, status: true } } },
    });
    if (payment) return payment;

    const orderUuid = paymentIntent.metadata?.order_uuid;
    if (!orderUuid) return null;

    return this.prisma.payments.findFirst({
      where: {
        provider: PaymentProvider.STRIPE,
        orders: { uuid: orderUuid },
      },
      include: { orders: { select: { user_id: true, status: true } } },
    });
  }

  private async markPaymentPaid(
    payment: StripePaymentRecord,
    payload: Stripe.Checkout.Session | Stripe.PaymentIntent,
    eventType: string,
  ) {
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
        data: {
          status: PaymentStatus.PAID,
          provider_payment_id:
            'object' in payload && payload.object === 'payment_intent'
              ? payload.id
              : undefined,
          raw_payload: this.buildPaymentRawPayload(
            payment.raw_payload,
            eventType,
            payload,
          ),
        },
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

    this.logger.log(`Order ${payment.order_id} marked as PAID`);
  }

  async listOrders(userId: bigint, options: PageQuery, locale: string) {
    const skip = (options.page - 1) * options.page_size;
    const take = options.page_size;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.orders.findMany({
        where: {
          user_id: userId,
          status: { in: [OrderStatus.PAID, OrderStatus.FAILED] },
        },
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
      this.prisma.orders.count({
        where: {
          user_id: userId,
          status: { in: [OrderStatus.PAID, OrderStatus.FAILED] },
        },
      }),
    ]);

    const items = await this.toOrderResponses(orders, userId, locale);

    return { items, total };
  }

  async listAdminOrders({
    page = 1,
    pageSize = 20,
    search,
    orderUuid,
    displayId,
    status,
    userUuid,
  }: AdminListOrdersOptions) {
    const where = this.buildAdminOrderWhere({
      search,
      orderUuid,
      displayId,
      status,
      userUuid,
    });
    const skip = (page - 1) * pageSize;

    const [orders, total] = await this.prisma.$transaction([
      this.findAdminOrderRecords(where, skip, pageSize),
      this.prisma.orders.count({ where }),
    ]);

    return {
      data: orders.map((order) => this.toAdminOrderResponse(order)),
      page,
      pageSize,
      total,
    };
  }

  private buildAdminOrderWhere({
    search,
    orderUuid,
    displayId,
    status,
    userUuid,
  }: Omit<
    AdminListOrdersOptions,
    'page' | 'pageSize'
  >): Prisma.ordersWhereInput {
    const normalizedSearch = search?.trim();
    const normalizedOrderUuid = orderUuid?.trim();
    const normalizedDisplayId = displayId?.trim();
    const normalizedUserUuid = userUuid?.trim();
    const searchOr: Prisma.ordersWhereInput[] = [];

    if (normalizedSearch) {
      searchOr.push({
        display_id: { contains: normalizedSearch, mode: QueryMode.insensitive },
      });

      if (this.isUuid(normalizedSearch)) {
        searchOr.push(
          { uuid: normalizedSearch },
          { users: { uuid: normalizedSearch } },
        );
      }
    }

    return {
      ...(normalizedOrderUuid ? { uuid: normalizedOrderUuid } : {}),
      ...(normalizedDisplayId
        ? {
            display_id: {
              contains: normalizedDisplayId,
              mode: QueryMode.insensitive,
            },
          }
        : {}),
      ...(status ? { status } : {}),
      ...(normalizedUserUuid ? { users: { uuid: normalizedUserUuid } } : {}),
      ...(searchOr.length ? { OR: searchOr } : {}),
    };
  }

  private findAdminOrderRecords(
    where: Prisma.ordersWhereInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        users: {
          select: {
            uuid: true,
            email: true,
            name: true,
          },
        },
        order_items: {
          orderBy: { created_at: 'asc' },
        },
        payments: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      skip,
      take,
    });
  }

  private toAdminOrderResponse(
    order: AdminOrderWithRelations,
  ): CmsOrderResponse {
    const payment = order.payments[0] ?? null;

    return {
      id: order.id.toString(),
      uuid: order.uuid,
      display_id: order.display_id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      fingerprint: order.fingerprint,
      created_at: order.created_at,
      updated_at: order.updated_at,
      user: {
        uuid: order.users.uuid,
        email: order.users.email,
        name: order.users.name,
      },
      payment: payment
        ? {
            provider: payment.provider,
            status: payment.status,
            provider_payment_id: payment.provider_payment_id,
            provider_session_id: payment.provider_session_id,
            checkout_url: payment.checkout_url,
            expires_at: payment.expires_at,
            created_at: payment.created_at,
            updated_at: payment.updated_at,
          }
        : null,
      items: order.order_items.map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id.toString(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        created_at: item.created_at,
      })),
    };
  }

  async getOrderByUuid(
    userId: bigint,
    uuid: string,
    locale: string,
  ): Promise<OrderResponse | null> {
    const order = await this.findOrderRecordByUuid(userId, uuid);
    if (!order) return null;

    const [response] = await this.toOrderResponses([order], userId, locale);
    return response ?? null;
  }

  async syncOrderByCheckoutSession(
    userId: bigint,
    sessionId: string,
    locale: string,
  ): Promise<OrderResponse | null> {
    const order = await this.findOrderRecordByCheckoutSession(
      userId,
      sessionId,
    );
    if (!order) return null;

    const payment = order.payments[0] ?? null;
    if (payment) {
      await this.syncPendingCheckoutSession(payment, sessionId);
    }

    const refreshedOrder = await this.findOrderRecordByCheckoutSession(
      userId,
      sessionId,
    );
    if (!refreshedOrder) return null;

    const [response] = await this.toOrderResponses(
      [refreshedOrder],
      userId,
      locale,
    );
    return response ?? null;
  }

  private async findOrderRecordByCheckoutSession(
    userId: bigint,
    sessionId: string,
  ) {
    return this.prisma.orders.findFirst({
      where: {
        user_id: userId,
        payments: {
          some: {
            provider: PaymentProvider.STRIPE,
            provider_session_id: sessionId,
          },
        },
      },
      include: {
        order_items: true,
        payments: {
          where: {
            provider: PaymentProvider.STRIPE,
            provider_session_id: sessionId,
          },
          take: 1,
        },
      },
    });
  }

  private async syncPendingCheckoutSession(
    payment: {
      id: bigint;
      status: string;
      updated_at: Date;
      raw_payload: unknown;
    },
    sessionId: string,
  ) {
    if (isEnumEqual(PaymentStatus.PAID, payment.status)) {
      return;
    }

    const now = new Date();
    const recentlySynced =
      payment.raw_payload &&
      now.getTime() - payment.updated_at.getTime() <
        OrderService.CHECKOUT_SESSION_SYNC_WINDOW_MS;
    if (recentlySynced) {
      return;
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.status === 'complete' &&
      isEnumEqual('paid', session.payment_status)
    ) {
      await this._onSessionCompleted(session);
      return;
    }

    if (session.status === 'expired') {
      await this._onSessionExpired(session);
      return;
    }

    await this.prisma.payments.update({
      where: { id: payment.id },
      data: {
        raw_payload: this.buildPaymentRawPayload(
          payment.raw_payload,
          'checkout.session.sync',
          session,
        ),
        updated_at: now,
      },
    });
  }

  private async getOrderByUuidOrThrow(
    userId: bigint,
    uuid: string,
    locale: string,
  ) {
    const order = await this.getOrderByUuid(userId, uuid, locale);
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
    locale: string,
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
      locale,
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
        display_id: order.display_id,
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

  private generateOrderDisplayId(date = new Date()) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => part.value)
      .join('');

    return `ORD-${datePart}-${this.generateRandomCode(8)}`;
  }

  private generateRandomCode(length: number) {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return Array.from(
      randomBytes(length),
      (byte) => alphabet[byte % alphabet.length],
    ).join('');
  }

  private buildPaymentRawPayload(
    existingRawPayload: unknown,
    eventType: string,
    payload: Stripe.Checkout.Session | Stripe.PaymentIntent,
  ) {
    const existingEvents =
      this.extractPaymentRawPayloadEvents(existingRawPayload);
    const event = {
      event_type: eventType,
      received_at: new Date().toISOString(),
      payload: payload as object,
    };

    return {
      latest_event_type: eventType,
      latest_payload: payload as object,
      events: [...existingEvents, event].slice(-20),
    };
  }

  private extractPaymentRawPayloadEvents(existingRawPayload: unknown) {
    if (
      existingRawPayload &&
      typeof existingRawPayload === 'object' &&
      'events' in existingRawPayload &&
      Array.isArray(existingRawPayload.events)
    ) {
      return existingRawPayload.events;
    }

    if (existingRawPayload) {
      return [
        {
          event_type: 'legacy',
          received_at: null,
          payload: existingRawPayload,
        },
      ];
    }

    return [];
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
