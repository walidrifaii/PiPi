import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  clampSharePercent,
  DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT,
  DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
} from './driver-delivery-share';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** DB value → `DRIVER_DELIVERY_FEE_SHARE_PERCENT` env → default 60. */
  async getDriverDeliverySharePercent(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY },
      select: { value: true },
    });
    if (row?.value?.trim()) {
      const parsed = Number(row.value.trim());
      if (Number.isFinite(parsed)) {
        return clampSharePercent(parsed);
      }
    }

    const fromEnv = process.env.DRIVER_DELIVERY_FEE_SHARE_PERCENT?.trim();
    if (fromEnv) {
      const parsed = Number(fromEnv);
      if (Number.isFinite(parsed)) {
        return clampSharePercent(parsed);
      }
    }

    return DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT;
  }

  async setDriverDeliverySharePercent(percent: number): Promise<number> {
    const safe = clampSharePercent(percent);
    if (!Number.isFinite(percent)) {
      throw new BadRequestException('percent must be a number between 0 and 100');
    }

    await this.prisma.appSetting.upsert({
      where: { key: DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY },
      create: {
        key: DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
        value: String(safe),
      },
      update: { value: String(safe) },
    });

    return safe;
  }
}
