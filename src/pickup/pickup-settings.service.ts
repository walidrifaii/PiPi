import { BadRequestException, Injectable } from '@nestjs/common';
import { isValidIanaTimeZone, normalizeLocalTimeTo24h } from '../common/merchant-open-status';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_NOW_MAX_MINUTES,
  DEFAULT_NOW_MIN_MINUTES,
  DEFAULT_PICKUP_SERVICE_FEE,
  DEFAULT_PICKUP_TIMEZONE,
  PICKUP_WEEKDAY_NAMES,
} from './pickup.constants';
import { UpdatePickupSettingsDto } from './dto/update-pickup-settings.dto';
import { ReplacePickupScheduleDto } from './dto/replace-pickup-schedule.dto';
import { parseWeekdayOrNull, weekdayLabel } from './pickup-time';

export type PickupSettingsView = {
  isEnabled: boolean;
  timezone: string;
  now: { minMinutes: number; maxMinutes: number };
  serviceFee: number;
  updatedAt: string;
};

export type PickupScheduleView = {
  timezone: string;
  days: Array<{
    weekday: number;
    weekdayName: string;
    slots: Array<{ start: string; end: string }>;
  }>;
};

@Injectable()
export class PickupSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async ensureSettings() {
    const existing = await this.prisma.pickupSetting.findUnique({
      where: { id: 1 },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.pickupSetting.create({
      data: {
        id: 1,
        isEnabled: true,
        timezone: DEFAULT_PICKUP_TIMEZONE,
        nowMinMinutes: DEFAULT_NOW_MIN_MINUTES,
        nowMaxMinutes: DEFAULT_NOW_MAX_MINUTES,
        serviceFee: DEFAULT_PICKUP_SERVICE_FEE,
      },
    });
  }

  async getSettings(): Promise<PickupSettingsView> {
    const row = await this.ensureSettings();
    return {
      isEnabled: row.isEnabled,
      timezone: row.timezone,
      now: {
        minMinutes: row.nowMinMinutes,
        maxMinutes: row.nowMaxMinutes,
      },
      serviceFee: this.roundMoney(Number(row.serviceFee)),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettings(dto: UpdatePickupSettingsDto): Promise<PickupSettingsView> {
    const current = await this.ensureSettings();
    const nowMin =
      dto.nowMinMinutes !== undefined ? dto.nowMinMinutes : current.nowMinMinutes;
    const nowMax =
      dto.nowMaxMinutes !== undefined ? dto.nowMaxMinutes : current.nowMaxMinutes;
    if (nowMax < nowMin) {
      throw new BadRequestException(
        'nowMaxMinutes must be greater than or equal to nowMinMinutes',
      );
    }

    let timezone = current.timezone;
    if (dto.timezone !== undefined) {
      const tz = dto.timezone.trim();
      if (!isValidIanaTimeZone(tz)) {
        throw new BadRequestException('timezone must be a valid IANA timezone');
      }
      timezone = tz;
    }

    await this.prisma.pickupSetting.update({
      where: { id: 1 },
      data: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        timezone,
        nowMinMinutes: nowMin,
        nowMaxMinutes: nowMax,
        ...(dto.serviceFee !== undefined ? { serviceFee: dto.serviceFee } : {}),
      },
    });
    return this.getSettings();
  }

  async getSchedule(): Promise<PickupScheduleView> {
    const settings = await this.ensureSettings();
    const rows = await this.prisma.pickupScheduleSlot.findMany({
      where: { isActive: true },
      orderBy: [{ weekday: 'asc' }, { sortOrder: 'asc' }, { startLocal: 'asc' }],
    });
    const byDay = new Map<number, Array<{ start: string; end: string }>>();
    for (const row of rows) {
      const list = byDay.get(row.weekday) ?? [];
      list.push({ start: row.startLocal, end: row.endLocal });
      byDay.set(row.weekday, list);
    }
    return {
      timezone: settings.timezone,
      days: Array.from({ length: 7 }, (_, i) => {
        const weekday = i + 1;
        return {
          weekday,
          weekdayName: weekdayLabel(weekday),
          slots: byDay.get(weekday) ?? [],
        };
      }),
    };
  }

  async replaceSchedule(
    dto: ReplacePickupScheduleDto,
  ): Promise<PickupScheduleView> {
    const normalized: Array<{
      weekday: number;
      startLocal: string;
      endLocal: string;
      sortOrder: number;
    }> = [];

    for (const day of dto.days) {
      const weekday = parseWeekdayOrNull(day.weekday);
      if (!weekday) {
        throw new BadRequestException(
          `Invalid weekday: ${String(day.weekday)}. Use 1–7 or Monday–Sunday.`,
        );
      }
      day.slots.forEach((slot, index) => {
        const startLocal = normalizeLocalTimeTo24h(slot.start);
        const endLocal = normalizeLocalTimeTo24h(slot.end);
        if (!startLocal || !endLocal) {
          throw new BadRequestException(
            `Invalid time on ${PICKUP_WEEKDAY_NAMES[weekday]}. Use HH:mm.`,
          );
        }
        const startM = startLocal.split(':').map(Number);
        const endM = endLocal.split(':').map(Number);
        if (endM[0] * 60 + endM[1] <= startM[0] * 60 + startM[1]) {
          throw new BadRequestException(
            `Slot end must be after start on ${PICKUP_WEEKDAY_NAMES[weekday]}`,
          );
        }
        normalized.push({
          weekday,
          startLocal,
          endLocal,
          sortOrder: index,
        });
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pickupScheduleSlot.deleteMany({});
      if (normalized.length > 0) {
        await tx.pickupScheduleSlot.createMany({ data: normalized });
      }
    });

    return this.getSchedule();
  }
}
