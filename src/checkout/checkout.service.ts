import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { resolveProductDisplayImage } from '../common/product-display-image';
import { DeliveryFeeService } from '../delivery-fee/delivery-fee.service';
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
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  listPrice: number;
  discountPrice: number | null;
  productDiscountPrice: number | null;
  merchantUnitPrice: number;
  merchantTotalPrice: number;
  message: string | null;
  selectedOptions: SelectedOptionSnapshot[];
};

export type CheckoutItemsSnapshot = {
  merchantName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryTimeMinutes: number;
  merchantOfferPercent: number | null;
  customerSubtotal: number;
  customerTotal: number;
  merchantSubtotal: number;
  merchantTotal: number;
  deliveryFee: number;
  deliveryFeeBreakdown: {
    fixedFee: number;
    includedKm: number;
    kmUnit: number;
    feePerUnit: number;
    maxFee: number;
    maxKm: number;
    deliveryFee: number;
    configId: string | null;
  };
  items: Array<{
    productId: string;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    listPrice: number;
    discountPrice: number | null;
    productDiscountPrice: number | null;
    unitPrice: number;
    totalPrice: number;
    merchantUnitPrice: number;
    merchantTotalPrice: number;
    message: string | null;
    selectedOptions: SelectedOptionSnapshot[];
  }>;
};

@Injectable()
export class CheckoutService {
  private static readonly MONEY_TOLERANCE = 0.02;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNotifications: OrderNotificationsPort,
    private readonly merchantOffers: MerchantOfferService,
    private readonly deliveryFees: DeliveryFeeService,
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
        imageUrl: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true },
        },
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
      const merchantPricing = resolveStorefrontProductPricing(
        listPrice,
        storedDiscount,
        null,
      );
      const productDiscountPrice = merchantPricing.discountPrice;

      const { selected } = validateProductOptionSelections(
        catalog.optionGroups,
        item.selectedChoiceIds,
      );
      const modifiers = selected.map((s) => s.priceModifier);

      const unitPrice = resolveUnitPriceWithOptions(
        listPrice,
        catalogDiscount,
        modifiers,
      );
      const merchantUnitPrice = resolveUnitPriceWithOptions(
        listPrice,
        productDiscountPrice,
        modifiers,
      );

      const baseName = item.productName.trim();
      const productName = formatProductNameWithOptions(baseName, selected);

      return {
        productId: item.productId,
        productName,
        imageUrl: resolveProductDisplayImage(catalog),
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        listPrice,
        discountPrice: catalogDiscount,
        productDiscountPrice,
        merchantUnitPrice,
        merchantTotalPrice: merchantUnitPrice * item.quantity,
        message: item.message?.trim() || null,
        selectedOptions: selected,
      };
    });

    const customerSubtotal = this.roundMoney(
      lineItems.reduce((sum, line) => sum + line.totalPrice, 0),
    );
    const merchantSubtotal = this.roundMoney(
      lineItems.reduce((sum, line) => sum + line.merchantTotalPrice, 0),
    );

    const feeCalc = await this.deliveryFees.computeForDistance(dto.distanceKm);
    const deliveryFee = this.roundMoney(feeCalc.deliveryFee);

    const customerTotal = this.roundMoney(customerSubtotal + deliveryFee);
    // Merchant is paid for food only; delivery fee goes to platform/driver.
    const merchantTotal = merchantSubtotal;

    this.assertClientMoney('subtotal', dto.subtotal, customerSubtotal);
    this.assertClientMoney('total', dto.total, customerTotal);
    const clientDeliveryFee = this.roundMoney(dto.total - dto.subtotal);
    this.assertClientMoney('delivery fee', clientDeliveryFee, deliveryFee);

    const checkoutRef = `chk_${randomUUID()}`;
    const itemsSnapshot: CheckoutItemsSnapshot = {
      merchantName: dto.merchantName.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      distanceKm: dto.distanceKm,
      deliveryTimeMinutes: dto.deliveryTimeMinutes,
      merchantOfferPercent: offerPercent,
      customerSubtotal,
      customerTotal,
      merchantSubtotal,
      merchantTotal,
      deliveryFee,
      deliveryFeeBreakdown: {
        fixedFee: feeCalc.fixedFee,
        includedKm: feeCalc.includedKm,
        kmUnit: feeCalc.kmUnit,
        feePerUnit: feeCalc.feePerUnit,
        maxFee: feeCalc.maxFee,
        maxKm: feeCalc.maxKm,
        deliveryFee: feeCalc.deliveryFee,
        configId: feeCalc.configId,
      },
      items: lineItems.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        imageUrl: l.imageUrl,
        quantity: l.quantity,
        listPrice: l.listPrice,
        discountPrice: l.discountPrice,
        productDiscountPrice: l.productDiscountPrice,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
        merchantUnitPrice: l.merchantUnitPrice,
        merchantTotalPrice: l.merchantTotalPrice,
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
          subtotal: customerSubtotal,
          deliveryFee,
          total: customerTotal,
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
      customerTotal,
      merchantTotal,
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
      ...(snapshot.merchantOfferPercent
        ? { merchantOfferPercent: snapshot.merchantOfferPercent }
        : {}),
      items: order.orderItems.map((oi, index) => {
        const snap = snapshot.items[index];
        return {
          id: oi.id,
          productId: oi.productId,
          productName: oi.productName,
          imageUrl: snap?.imageUrl ?? null,
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

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private assertClientMoney(field: string, client: number, server: number) {
    if (
      Math.abs(this.roundMoney(client) - server) >
      CheckoutService.MONEY_TOLERANCE
    ) {
      throw new BadRequestException(
        `Order ${field} does not match server pricing. Please refresh and try again.`,
      );
    }
  }

  private async notifyMerchantAndAdminsNewOrder(params: {
    orderId: string;
    merchantId: string;
    merchantName: string;
    userId: string;
    customerTotal: number;
    merchantTotal: number;
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

      const customerName = customer?.fullName ?? undefined;
      const merchantToken = merchant?.fcmToken?.trim();
      if (merchantToken) {
        await this.orderNotifications.sendNewOrderAlert({
          tokens: [merchantToken],
          orderId: params.orderId,
          merchantId: params.merchantId,
          merchantName: params.merchantName,
          customerName,
          total: params.merchantTotal,
        });
      }

      const adminTokens = admins
        .map((a) => a.fcmToken?.trim())
        .filter((t): t is string => !!t && t.length > 0);
      if (adminTokens.length > 0) {
        await this.orderNotifications.sendNewOrderAlert({
          tokens: adminTokens,
          orderId: params.orderId,
          merchantId: params.merchantId,
          merchantName: params.merchantName,
          customerName,
          total: params.customerTotal,
        });
      }
    } catch {
      // Checkout must succeed even if push fails.
    }
  }
}
