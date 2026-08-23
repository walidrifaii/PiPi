import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PickupBlockedZoneService } from '../pickup/pickup-blocked-zone.service';
import { PickupLocationInputDto } from '../pickup/dto/create-pickup.dto';
import { PICKUP_MONEY_TOLERANCE } from '../pickup/pickup.constants';
import { CreateSpecialRequestDto } from './dto/create-special-request.dto';
import { ListSpecialRequestsAdminQueryDto } from './dto/admin-special-request.dto';
import {
  canAdminTransitionSpecialRequest,
  normalizeSpecialRequestStatus,
} from './special-request.constants';
import {
  mapSpecialRequest,
  type SpecialRequestFeeSnapshot,
} from './special-request.mapper';
import { SpecialRequestSettingsService } from './special-request-settings.service';

export const specialRequestInclude = {
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      vehicleType: true,
    },
  },
  user: {
    select: { id: true, fullName: true, phone: true },
  },
} as const;

@Injectable()
export class SpecialRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SpecialRequestSettingsService,
    private readonly blocked: PickupBlockedZoneService,
  ) {}

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private assertClientMoney(field: string, client: number, server: number) {
    if (Math.abs(this.roundMoney(client) - server) > PICKUP_MONEY_TOLERANCE) {
      throw new BadRequestException(
        `Special request ${field} does not match server pricing. Please refresh and try again.`,
      );
    }
  }

  async getPublicConfig() {
    const settings = await this.settings.getSettings();
    return {
      isEnabled: settings.isEnabled,
      timezone: settings.timezone,
      now: settings.now,
      buyFee: settings.buyFee,
      serviceFee: settings.serviceFee,
    };
  }

  async quote(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const settings = await this.settings.getSettings();
    if (!settings.isEnabled) {
      throw new BadRequestException(
        'Special requests are not available right now',
      );
    }
    await this.blocked.assertRouteAllowed(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    );
    return {
      buyFee: settings.buyFee,
      serviceFee: settings.serviceFee,
      deliveryFee: 0,
      total: settings.buyFee,
      now: settings.now,
    };
  }

  private async resolveLocation(
    userId: string,
    dto: PickupLocationInputDto,
    label: 'from' | 'to',
  ) {
    let addressLine = dto.addressLine?.trim() ?? '';
    if (dto.addressId) {
      const saved = await this.prisma.userAddress.findFirst({
        where: { id: dto.addressId, userId },
        select: { id: true, addressLine: true, latitude: true, longitude: true },
      });
      if (!saved) {
        throw new NotFoundException(`${label} address not found`);
      }
      if (!addressLine) {
        addressLine = saved.addressLine;
      }
      return {
        addressId: saved.id,
        addressLine,
        latitude: dto.latitude,
        longitude: dto.longitude,
      };
    }
    if (!addressLine) {
      throw new BadRequestException(`${label} addressLine is required`);
    }
    return {
      addressId: null as string | null,
      addressLine,
      latitude: dto.latitude,
      longitude: dto.longitude,
    };
  }

  async create(userId: string, dto: CreateSpecialRequestDto) {
    const settings = await this.settings.getSettings();
    if (!settings.isEnabled) {
      throw new BadRequestException(
        'Special requests are not available right now',
      );
    }

    const from = await this.resolveLocation(userId, dto.from, 'from');
    const to = await this.resolveLocation(userId, dto.to, 'to');

    await this.blocked.assertRouteAllowed(
      { lat: from.latitude, lng: from.longitude },
      { lat: to.latitude, lng: to.longitude },
    );

    const buyFee = settings.buyFee;
    const serviceFee = buyFee;
    const deliveryFee = 0;
    const total = buyFee;
    this.assertClientMoney('service fee', dto.serviceFee, serviceFee);

    const etaMinMinutes = settings.now.minMinutes;
    const etaMaxMinutes = settings.now.maxMinutes;
    const snapshot: SpecialRequestFeeSnapshot = {
      buyFee,
      serviceFee,
      deliveryFee,
      total,
      etaMinMinutes,
      etaMaxMinutes,
      timezone: settings.timezone,
    };

    const created = await this.prisma.specialRequest.create({
      data: {
        userId,
        status: 'PENDING',
        storeName: dto.storeName.trim(),
        itemName: dto.itemName.trim(),
        productImageUrl: dto.productImageUrl.trim(),
        requestRef: `srq_${randomUUID()}`,
        serviceFee,
        deliveryFee,
        total,
        fromAddressLine: from.addressLine,
        fromLatitude: from.latitude,
        fromLongitude: from.longitude,
        fromAddressId: from.addressId,
        toAddressLine: to.addressLine,
        toLatitude: to.latitude,
        toLongitude: to.longitude,
        toAddressId: to.addressId,
        etaMinMinutes,
        etaMaxMinutes,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: specialRequestInclude,
    });

    return mapSpecialRequest(created);
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const safePage = page > 0 ? page : 1;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.specialRequest.findMany({
        where,
        include: specialRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.specialRequest.count({ where }),
    ]);
    return {
      items: rows.map((row) => mapSpecialRequest(row)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getForUser(userId: string, requestId: string) {
    const row = await this.prisma.specialRequest.findFirst({
      where: { id: requestId, userId },
      include: specialRequestInclude,
    });
    if (!row) {
      throw new NotFoundException('Special request not found');
    }
    return mapSpecialRequest(row);
  }

  async listForAdmin(query: ListSpecialRequestsAdminQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const where: Prisma.SpecialRequestWhereInput = {};

    if (query.requestId) {
      where.id = query.requestId;
    }
    if (query.storeName?.trim()) {
      where.storeName = {
        contains: query.storeName.trim(),
        mode: 'insensitive',
      };
    }
    if (query.itemName?.trim()) {
      where.itemName = {
        contains: query.itemName.trim(),
        mode: 'insensitive',
      };
    }
    if (query.status === 'LIVE') {
      where.status = { notIn: ['DELIVERED', 'CANCELLED'] };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.userName?.trim() || query.number?.trim()) {
      where.user = {
        ...(query.userName?.trim()
          ? {
              fullName: {
                contains: query.userName.trim(),
                mode: 'insensitive',
              },
            }
          : {}),
        ...(query.number?.trim()
          ? { phone: { contains: query.number.trim() } }
          : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.specialRequest.findMany({
        where,
        include: specialRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.specialRequest.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapSpecialRequest(row)),
      total,
      page,
      limit,
    };
  }

  async getForAdmin(requestId: string) {
    const row = await this.prisma.specialRequest.findUnique({
      where: { id: requestId },
      include: specialRequestInclude,
    });
    if (!row) {
      throw new NotFoundException('Special request not found');
    }
    return mapSpecialRequest(row);
  }

  async updateStatusForAdmin(requestId: string, status: string) {
    const existing = await this.prisma.specialRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    if (!existing) {
      throw new NotFoundException('Special request not found');
    }
    if (!canAdminTransitionSpecialRequest(existing.status, status)) {
      throw new BadRequestException(
        `Cannot change special request from ${normalizeSpecialRequestStatus(existing.status)} to ${status}`,
      );
    }
    const row = await this.prisma.specialRequest.update({
      where: { id: requestId },
      data: { status },
      include: specialRequestInclude,
    });
    return mapSpecialRequest(row);
  }
}
