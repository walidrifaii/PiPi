import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  formatProductNameWithOptions,
  resolveUnitPriceWithOptions,
  validateProductOptionSelections,
} from '../common/product-option-pricing';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import type { SelectedOptionSnapshot } from '../merchant/product-option.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { MerchantOfferService } from '../merchant-offer/merchant-offer.service';
import { resolveStorefrontProductPricing } from '../merchant-offer/merchant-offer-pricing';

type LineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  listPrice: number;
  discountPrice: number | null;
  message: string | null;
  selectedOptions: SelectedOptionSnapshot[];
};

export type CheckoutItemsSnapshot = {
  merchantName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryTimeMinutes: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    listPrice: number;
    discountPrice: number | null;
    unitPrice: number;
    totalPrice: number;
    message: string | null;
    selectedOptions: SelectedOptionSnapshot[];
  }>;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNotifications: OrderNotificationsPort,
    private readonly merchantOffers: MerchantOfferService,
  ) {}

  async createOrder(userId: string, dto: CreateCheckoutDto) {
    if (dto.total < dto.subtotal) {
      throw new BadRequestException('total cannot be less than subtotal');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: dto.merchantId },
      select: { id: true, isActive: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    if (!merchant.isActive) {
      throw new BadRequestException('Merchant is not accepting orders');
    }

    if (dto.addressId) {
      const saved = await this.prisma.userAddress.findFirst({
        where: { id: dto.addressId, userId },
        select: { id: true },
      });
      if (!saved) {
        throw new NotFoundException('Delivery address not found');
      }
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        category: { merchantId: dto.merchantId },
      },
      select: {
        id: true,
        price: true,
        discountPrice: true,
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            choices: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products are invalid or belong to a different merchant',
      );
    }

    const productById = new Map(products.map((p) => [p.id, p]));

    const offerPercent =
      await this.merchantOffers.getLiveOfferPercentForMerchant(dto.merchantId);

    const lineItems: LineItem[] = dto.items.map((item) => {
      const catalog = productById.get(item.productId);
      if (!catalog) {
        throw new BadRequestException('Invalid product');
      }

      const listPrice = Number(catalog.price);
      const storedDiscount =
        catalog.discountPrice !== null ? Number(catalog.discountPrice) : null;
      const pricing = resolveStorefrontProductPricing(
        listPrice,
        storedDiscount,
        offerPercent,
      );
      const catalogDiscount = pricing.discountPrice;

      const { selected } = validateProductOptionSelections(
        catalog.optionGroups,
        item.selectedChoiceIds,
      );

      const unitPrice = resolveUnitPriceWithOptions(
        listPrice,
        catalogDiscount,
        selected.map((s) => s.priceModifier),
      );

      const baseName = item.productName.trim();
      const productName = formatProductNameWithOptions(baseName, selected);

      return {
        productId: item.productId,
        productName,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        listPrice,
        discountPrice: catalogDiscount,
        message: item.message?.trim() || null,
        selectedOptions: selected,
      };
    });

    const deliveryFee =
      Math.round((dto.total - dto.subtotal) * 100) / 100;
    const checkoutRef = `chk_${randomUUID()}`;
    const itemsSnapshot: CheckoutItemsSnapshot = {
      merchantName: dto.merchantName.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      distanceKm: dto.distanceKm,
      deliveryTimeMinutes: dto.deliveryTimeMinutes,
      items: lineItems.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        listPrice: l.listPrice,
        discountPrice: l.discountPrice,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
        message: l.message,
        selectedOptions: l.selectedOptions,
      })),
    };

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          merchantId: dto.merchantId,
          addressId: dto.addressId ?? null,
          status: 'PENDING',
          subtotal: dto.subtotal,
          deliveryFee,
          total: dto.total,
          deliveryAddress: null,
          notes: dto.notes ?? null,
          checkoutRef,
          itemsSnapshot,
          orderItems: {
            create: lineItems.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              totalPrice: l.totalPrice,
            })),
          },
        },
        include: {
          orderItems: true,
          merchant: { select: { id: true, name: true } },
          address: {
            select: {
              id: true,
              addressLine: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });
      return created;
    });

    const snapshot = order.itemsSnapshot as CheckoutItemsSnapshot;

    void this.notifyMerchantAndAdminsNewOrder({
      orderId: order.id,
      merchantId: order.merchant.id,
      merchantName: snapshot.merchantName,
      userId,
      total: Number(order.total),
    });

    return {
      id: order.id,
      checkoutRef: order.checkoutRef,
      status: order.status,
      merchantId: order.merchant.id,
      merchantName: snapshot.merchantName,
      merchant: {
        id: order.merchant.id,
        name: snapshot.merchantName,
      },
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      distanceKm: snapshot.distanceKm,
      deliveryTimeMinutes: snapshot.deliveryTimeMinutes,
      address: order.address
        ? {
            id: order.address.id,
            addressLine: order.address.addressLine,
            latitude: Number(order.address.latitude),
            longitude: Number(order.address.longitude),
          }
        : null,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      items: order.orderItems.map((oi, index) => {
        const snap = snapshot.items[index];
        return {
          id: oi.id,
          productId: oi.productId,
          productName: oi.productName,
          quantity: oi.quantity,
          price: snap?.listPrice ?? Number(oi.unitPrice),
          discountPrice: snap?.discountPrice ?? null,
          unitPrice: Number(oi.unitPrice),
          totalPrice: Number(oi.totalPrice),
          message: snap?.message ?? null,
          selectedOptions: snap?.selectedOptions ?? [],
        };
      }),
      createdAt: order.createdAt,
    };
  }

  private async notifyMerchantAndAdminsNewOrder(params: {
    orderId: string;
    merchantId: string;
    merchantName: string;
    userId: string;
    total: number;
  }) {
    try {
      const [merchant, admins, customer] = await Promise.all([
        this.prisma.merchant.findUnique({
          where: { id: params.merchantId },
          select: { fcmToken: true },
        }),
        this.prisma.superAdmin.findMany({
          where: { isActive: true, fcmToken: { not: null } },
          select: { fcmToken: true },
        }),
        this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { fullName: true },
        }),
      ]);

      const tokens: string[] = [];
      const merchantToken = merchant?.fcmToken?.trim();
      if (merchantToken) {
        tokens.push(merchantToken);
      }
      for (const admin of admins) {
        const t = admin.fcmToken?.trim();
        if (t) {
          tokens.push(t);
        }
      }

      await this.orderNotifications.sendNewOrderAlert({
        tokens,
        orderId: params.orderId,
        merchantId: params.merchantId,
        merchantName: params.merchantName,
        customerName: customer?.fullName ?? undefined,
        total: params.total,
      });
    } catch {
      // Checkout must succeed even if push fails.
    }
  }
}
