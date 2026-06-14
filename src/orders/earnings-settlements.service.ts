import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeMerchantEarningsFromFoodSubtotal,
  roundMoney,
} from '../platform-settings/driver-delivery-share';
import { mapDriverOrderOffer } from './order-driver.mapper';
import {
  EARNINGS_SETTLEMENT_STATUS_PAID,
  EarningsParticipantType,
  generateSettlementReferenceCode,
  parseSettlementOrderIds,
} from './earnings-settlement.constants';
import { OrderItemsSnapshot } from './order.types';

const driverOrderSelect = {
  id: true,
  status: true,
  checkoutRef: true,
  createdAt: true,
  subtotal: true,
  deliveryFee: true,
  itemsSnapshot: true,
  merchant: { select: { name: true } },
} satisfies Prisma.OrderSelect;

const merchantOrderSelect = {
  id: true,
  checkoutRef: true,
  createdAt: true,
  itemsSnapshot: true,
  subtotal: true,
} satisfies Prisma.OrderSelect;

@Injectable()
export class EarningsSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaidOrderIds(
    participantType: EarningsParticipantType,
    participantId: string,
  ): Promise<Set<string>> {
    const where =
      participantType === 'DRIVER'
        ? { driverId: participantId, status: EARNINGS_SETTLEMENT_STATUS_PAID }
        : { merchantId: participantId, status: EARNINGS_SETTLEMENT_STATUS_PAID };

    const rows = await this.prisma.earningsSettlement.findMany({
      where,
      select: { orderIds: true },
    });

    const ids = new Set<string>();
    for (const row of rows) {
      for (const orderId of parseSettlementOrderIds(row.orderIds)) {
        ids.add(orderId);
      }
    }
    return ids;
  }

  private settlementWhere(
    participantType: EarningsParticipantType,
    participantId: string,
    from?: Date,
    to?: Date,
  ): Prisma.EarningsSettlementWhereInput {
    return {
      participantType,
      status: EARNINGS_SETTLEMENT_STATUS_PAID,
      ...(participantType === 'DRIVER'
        ? { driverId: participantId }
        : { merchantId: participantId }),
      ...(from || to
        ? {
            paidAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
  }

  private mapSettlementRow(row: {
    id: string;
    referenceCode: string;
    periodFrom: Date;
    periodTo: Date;
    grossAmount: { toString(): string };
    netAmount: { toString(): string };
    platformFee: { toString(): string };
    orderCount: number;
    status: string;
    paidAt: Date;
  }) {
    return {
      id: row.id,
      referenceCode: row.referenceCode,
      periodFrom: row.periodFrom.toISOString(),
      periodTo: row.periodTo.toISOString(),
      grossAmount: Number(row.grossAmount),
      netAmount: Number(row.netAmount),
      platformFee: Number(row.platformFee),
      orderCount: row.orderCount,
      status: row.status,
      paidAt: row.paidAt.toISOString(),
    };
  }

  async listSettlements(
    participantType: EarningsParticipantType,
    participantId: string,
    from?: Date,
    to?: Date,
  ) {
    const rows = await this.prisma.earningsSettlement.findMany({
      where: this.settlementWhere(participantType, participantId, from, to),
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    return rows.map((row) => this.mapSettlementRow(row));
  }

  async listSettlementsPaged(
    participantType: EarningsParticipantType,
    participantId: string,
    options: {
      from?: Date;
      to?: Date;
      page: number;
      limit: number;
    },
  ) {
    const where = this.settlementWhere(
      participantType,
      participantId,
      options.from,
      options.to,
    );
    const skip = (options.page - 1) * options.limit;

    const [total, rows] = await Promise.all([
      this.prisma.earningsSettlement.count({ where }),
      this.prisma.earningsSettlement.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip,
        take: options.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.mapSettlementRow(row)),
      total,
    };
  }

  async findMerchantSettlement(merchantId: string, settlementId: string) {
    const row = await this.prisma.earningsSettlement.findFirst({
      where: {
        id: settlementId,
        merchantId,
        participantType: 'MERCHANT',
        status: EARNINGS_SETTLEMENT_STATUS_PAID,
      },
    });
    if (!row) {
      throw new NotFoundException('Settlement not found');
    }
    return row;
  }

  private parseItemsSnapshot(raw: unknown): OrderItemsSnapshot | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const snapshot = raw as OrderItemsSnapshot;
    if (!Array.isArray(snapshot.items)) {
      return null;
    }
    return snapshot;
  }

  private merchantGrossFoodFromRow(row: {
    itemsSnapshot: unknown;
    subtotal: { toString(): string } | null;
  }): number {
    const snapshot = this.parseItemsSnapshot(row.itemsSnapshot);
    if (snapshot?.merchantSubtotal !== undefined) {
      return roundMoney(snapshot.merchantSubtotal);
    }
    if (row.subtotal !== null) {
      return roundMoney(Number(row.subtotal));
    }
    return 0;
  }

  async markDriverEarningsPaid(
    driverId: string,
    from: Date,
    to: Date,
    sharePercent: number,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const paidOrderIds = await this.getPaidOrderIds('DRIVER', driverId);
    const rows = await this.prisma.order.findMany({
      where: {
        driverId,
        status: 'DELIVERED',
        createdAt: { gte: from, lte: to },
        ...(paidOrderIds.size > 0 ? { id: { notIn: [...paidOrderIds] } } : {}),
      },
      select: driverOrderSelect,
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) {
      throw new BadRequestException('No unpaid earnings in this period');
    }

    let grossAmount = 0;
    let netAmount = 0;
    let platformFee = 0;
    const orderIds: string[] = [];

    for (const row of rows) {
      const mapped = mapDriverOrderOffer({
        ...row,
        driverSharePercent: sharePercent,
      });
      const fullDeliveryFee = mapped.deliveryFee ?? 0;
      const driverEarnings = mapped.driverEarnings ?? mapped.fee ?? 0;
      const platformShare = Math.max(0, fullDeliveryFee - driverEarnings);
      grossAmount += fullDeliveryFee;
      netAmount += driverEarnings;
      platformFee += platformShare;
      orderIds.push(row.id);
    }

    return this.prisma.earningsSettlement.create({
      data: {
        participantType: 'DRIVER',
        driverId,
        referenceCode: generateSettlementReferenceCode(),
        periodFrom: from,
        periodTo: to,
        grossAmount: roundMoney(grossAmount),
        netAmount: roundMoney(netAmount),
        platformFee: roundMoney(platformFee),
        orderCount: orderIds.length,
        orderIds,
        status: EARNINGS_SETTLEMENT_STATUS_PAID,
      },
    });
  }

  async markMerchantEarningsPaid(
    merchantId: string,
    from: Date,
    to: Date,
    sharePercent: number,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const paidOrderIds = await this.getPaidOrderIds('MERCHANT', merchantId);
    const rows = await this.prisma.order.findMany({
      where: {
        merchantId,
        status: 'DELIVERED',
        createdAt: { gte: from, lte: to },
        ...(paidOrderIds.size > 0 ? { id: { notIn: [...paidOrderIds] } } : {}),
      },
      select: merchantOrderSelect,
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) {
      throw new BadRequestException('No unpaid earnings in this period');
    }

    let grossAmount = 0;
    let netAmount = 0;
    const orderIds: string[] = [];

    for (const row of rows) {
      const gross = this.merchantGrossFoodFromRow(row);
      const net = computeMerchantEarningsFromFoodSubtotal(gross, sharePercent);
      grossAmount += gross;
      netAmount += net;
      orderIds.push(row.id);
    }

    const platformFee = roundMoney(Math.max(0, grossAmount - netAmount));

    return this.prisma.earningsSettlement.create({
      data: {
        participantType: 'MERCHANT',
        merchantId,
        referenceCode: generateSettlementReferenceCode(),
        periodFrom: from,
        periodTo: to,
        grossAmount: roundMoney(grossAmount),
        netAmount: roundMoney(netAmount),
        platformFee,
        orderCount: orderIds.length,
        orderIds,
        status: EARNINGS_SETTLEMENT_STATUS_PAID,
      },
    });
  }
}
