import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { haversineDistanceKm } from '../common/haversine';
import { PrismaService } from '../prisma/prisma.service';
import { PickupBlockedZoneService } from './pickup-blocked-zone.service';
import { PickupDeliveryFeeService } from './pickup-delivery-fee.service';
import { PickupSettingsService } from './pickup-settings.service';
import { CreatePickupDto, PickupLocationInputDto } from './dto/create-pickup.dto';
import { ListPickupsAdminQueryDto } from './dto/admin-pickup.dto';
import {
  canAdminTransitionPickup,
  normalizePickupStatus,
  PICKUP_DISTANCE_TOLERANCE_KM,
  PICKUP_MONEY_TOLERANCE,
} from './pickup.constants';
import { mapPickupOrder, type PickupFeeSnapshot } from './pickup.mapper';
import {
  addCalendarDays,
  getZonedClock,
  isoWeekdayForDateKey,
  slotContainsMinutes,
} from './pickup-time';

const pickupInclude = {
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
export class PickupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PickupSettingsService,
    private readonly fees: PickupDeliveryFeeService,
    private readonly blocked: PickupBlockedZoneService,
  ) {}

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundKm(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private assertClientMoney(field: string, client: number, server: number) {
    if (Math.abs(this.roundMoney(client) - server) > PICKUP_MONEY_TOLERANCE) {
      throw new BadRequestException(
        `Pickup ${field} does not match server pricing. Please refresh and try again.`,
      );
    }
  }

  async activateDueScheduled(): Promise<number> {
    const result = await this.prisma.pickupOrder.updateMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      data: { status: 'PENDING' },
    });
    return result.count;
  }

  async getPublicConfig() {
    const [settings, schedule] = await Promise.all([
      this.settings.getSettings(),
      this.settings.getSchedule(),
    ]);
    return {
      isEnabled: settings.isEnabled,
      timezone: settings.timezone,
      now: settings.now,
      serviceFee: settings.serviceFee,
      schedule: schedule.days,
    };
  }

  async listBookableSlots(fromDate?: string, days = 14) {
    const settings = await this.settings.getSettings();
    const schedule = await this.settings.getSchedule();
    const now = new Date();
    const clock = getZonedClock(now, settings.timezone);
    if (!clock) {
      throw new BadRequestException('Could not resolve pickup timezone');
    }

    const startKey =
      fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate.trim())
        ? fromDate.trim()
        : clock.dateKey;
    const slotsByWeekday = new Map(
      schedule.days.map((d) => [d.weekday, d.slots] as const),
    );
    const out: Array<{
      date: string;
      weekday: number;
      weekdayName: string;
      slots: Array<{ start: string; end: string }>;
    }> = [];

    for (let i = 0; i < days; i++) {
      const dateKey = addCalendarDays(startKey, i);
      const weekday = isoWeekdayForDateKey(dateKey);
      const day = schedule.days.find((d) => d.weekday === weekday);
      let slots = slotsByWeekday.get(weekday) ?? [];
      if (dateKey === clock.dateKey) {
        slots = slots.filter((slot) => {
          const end = slot.end.split(':').map(Number);
          const endMinutes = end[0] * 60 + end[1];
          return endMinutes > clock.minutes;
        });
      }
      if (!day || slots.length === 0) {
        continue;
      }
      out.push({
        date: dateKey,
        weekday,
        weekdayName: day.weekdayName,
        slots,
      });
    }

    return { timezone: settings.timezone, days: out };
  }

  async quote(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const settings = await this.settings.getSettings();
    if (!settings.isEnabled) {
      throw new BadRequestException('Pickup is not available right now');
    }
    await this.blocked.assertRouteAllowed(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    );
    const distanceKm = this.roundKm(
      haversineDistanceKm(fromLat, fromLng, toLat, toLng),
    );
    const feeCalc = await this.fees.computeForDistance(distanceKm);
    const deliveryFee = this.roundMoney(feeCalc.deliveryFee);
    const serviceFee = settings.serviceFee;
    return {
      distanceKm,
      serviceFee,
      deliveryFee,
      total: this.roundMoney(serviceFee + deliveryFee),
      now: settings.now,
      deliveryFeeBreakdown: feeCalc,
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

  private async assertScheduledAt(scheduledAtIso: string, timezone: string) {
    const scheduledAt = new Date(scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO datetime');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }
    const clock = getZonedClock(scheduledAt, timezone);
    if (!clock) {
      throw new BadRequestException('Could not resolve scheduled time');
    }
    const schedule = await this.settings.getSchedule();
    const day = schedule.days.find((d) => d.weekday === clock.weekday);
    const ok = day?.slots.some((slot) =>
      slotContainsMinutes(slot.start, slot.end, clock.minutes),
    );
    if (!ok) {
      throw new BadRequestException(
        'scheduledAt is outside the available pickup hours for that day',
      );
    }
    return scheduledAt;
  }

  async create(userId: string, dto: CreatePickupDto) {
    const settings = await this.settings.getSettings();
    if (!settings.isEnabled) {
      throw new BadRequestException('Pickup is not available right now');
    }

    const from = await this.resolveLocation(userId, dto.from, 'from');
    const to = await this.resolveLocation(userId, dto.to, 'to');

    await this.blocked.assertRouteAllowed(
      { lat: from.latitude, lng: from.longitude },
      { lat: to.latitude, lng: to.longitude },
    );

    const distanceKm = this.roundKm(
      haversineDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude),
    );
    if (Math.abs(distanceKm - dto.distanceKm) > PICKUP_DISTANCE_TOLERANCE_KM) {
      throw new BadRequestException(
        'Pickup distance does not match server routing. Please refresh and try again.',
      );
    }

    const feeCalc = await this.fees.computeForDistance(distanceKm);
    const deliveryFee = this.roundMoney(feeCalc.deliveryFee);
    const serviceFee = settings.serviceFee;
    const total = this.roundMoney(serviceFee + deliveryFee);
    this.assertClientMoney('delivery fee', dto.deliveryFee, deliveryFee);
    this.assertClientMoney('service fee', dto.serviceFee, serviceFee);

    let scheduledAt: Date | null = null;
    let status: 'PENDING' | 'SCHEDULED' = 'PENDING';
    let etaMinMinutes: number | null = settings.now.minMinutes;
    let etaMaxMinutes: number | null = settings.now.maxMinutes;

    if (dto.method === 'SCHEDULED') {
      if (!dto.scheduledAt) {
        throw new BadRequestException('scheduledAt is required for SCHEDULED pickup');
      }
      scheduledAt = await this.assertScheduledAt(dto.scheduledAt, settings.timezone);
      status = 'SCHEDULED';
      etaMinMinutes = null;
      etaMaxMinutes = null;
    } else if (dto.scheduledAt) {
      throw new BadRequestException('scheduledAt is only allowed for SCHEDULED pickup');
    }

    const snapshot: PickupFeeSnapshot = {
      serviceFee,
      deliveryFee,
      total,
      distanceKm,
      deliveryFeeBreakdown: feeCalc,
      etaMinMinutes,
      etaMaxMinutes,
      timezone: settings.timezone,
    };

    const created = await this.prisma.pickupOrder.create({
      data: {
        userId,
        method: dto.method,
        status,
        description: dto.description.trim(),
        declaredValue: this.roundMoney(dto.declaredValue),
        serviceFee,
        deliveryFee,
        total,
        distanceKm,
        pickupRef: `pkp_${randomUUID()}`,
        fromAddressLine: from.addressLine,
        fromLatitude: from.latitude,
        fromLongitude: from.longitude,
        fromAddressId: from.addressId,
        toAddressLine: to.addressLine,
        toLatitude: to.latitude,
        toLongitude: to.longitude,
        toAddressId: to.addressId,
        recipientFullName: dto.recipientFullName.trim(),
        recipientPhone: dto.recipientPhone.trim(),
        scheduledAt,
        etaMinMinutes,
        etaMaxMinutes,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: pickupInclude,
    });

    return mapPickupOrder(created);
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    await this.activateDueScheduled();
    const safePage = page > 0 ? page : 1;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.pickupOrder.findMany({
        where,
        include: pickupInclude,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.pickupOrder.count({ where }),
    ]);
    return {
      items: rows.map((row) => mapPickupOrder(row)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getForUser(userId: string, pickupId: string) {
    await this.activateDueScheduled();
    const row = await this.prisma.pickupOrder.findFirst({
      where: { id: pickupId, userId },
      include: pickupInclude,
    });
    if (!row) {
      throw new NotFoundException('Pickup not found');
    }
    return mapPickupOrder(row);
  }

  async listForAdmin(query: ListPickupsAdminQueryDto) {
    await this.activateDueScheduled();
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const where: Prisma.PickupOrderWhereInput = {};

    if (query.pickupId) {
      where.id = query.pickupId;
    }
    if (query.method) {
      where.method = query.method;
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
      const name = query.userName?.trim();
      const number = query.number?.trim();
      const nameMatch: Prisma.PickupOrderWhereInput[] = name
        ? [
            { user: { fullName: { contains: name, mode: 'insensitive' } } },
            { recipientFullName: { contains: name, mode: 'insensitive' } },
          ]
        : [];
      const numberMatch: Prisma.PickupOrderWhereInput[] = number
        ? [
            { user: { phone: { contains: number } } },
            { recipientPhone: { contains: number } },
          ]
        : [];
      if (nameMatch.length && numberMatch.length) {
        where.AND = [{ OR: nameMatch }, { OR: numberMatch }];
      } else {
        where.OR = nameMatch.length ? nameMatch : numberMatch;
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.pickupOrder.findMany({
        where,
        include: pickupInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pickupOrder.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapPickupOrder(row)),
      total,
      page,
      limit,
    };
  }

  async getForAdmin(pickupId: string) {
    await this.activateDueScheduled();
    const row = await this.prisma.pickupOrder.findUnique({
      where: { id: pickupId },
      include: pickupInclude,
    });
    if (!row) {
      throw new NotFoundException('Pickup not found');
    }
    return mapPickupOrder(row);
  }

  async updateStatusForAdmin(pickupId: string, status: string) {
    const existing = await this.prisma.pickupOrder.findUnique({
      where: { id: pickupId },
      select: { status: true },
    });
    if (!existing) {
      throw new NotFoundException('Pickup not found');
    }
    if (!canAdminTransitionPickup(existing.status, status)) {
      throw new BadRequestException(
        `Cannot change pickup from ${normalizePickupStatus(existing.status)} to ${status}`,
      );
    }
    const row = await this.prisma.pickupOrder.update({
      where: { id: pickupId },
      data: { status },
      include: pickupInclude,
    });
    return mapPickupOrder(row);
  }
}
