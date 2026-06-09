import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computePlatformOpenNow,
  DEFAULT_PLATFORM_CLOSE_LOCAL,
  DEFAULT_PLATFORM_OPEN_LOCAL,
  isValidIanaTimeZone,
  MERCHANT_TIMEZONE_LEBANON,
  normalizeLocalTimeTo24h,
  type PlatformOperatingHours,
  type PlatformOperatingStatus,
} from '../common/merchant-open-status';
import {
  PLATFORM_CLOSE_LOCAL_KEY,
  PLATFORM_OPEN_LOCAL_KEY,
  PLATFORM_TIMEZONE_KEY,
  PLATFORM_USE_OPERATING_HOURS_KEY,
} from './platform-operating-hours.constants';
import {
  clampSharePercent,
  DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT,
  DEFAULT_MERCHANT_FOOD_SHARE_PERCENT,
  DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
  MERCHANT_FOOD_SHARE_PERCENT_KEY,
  platformSharePercent,
} from './driver-delivery-share';
import { UpdatePlatformEarningsDto } from './dto/update-platform-earnings.dto';
import { UpdatePlatformOperatingHoursDto } from './dto/update-platform-operating-hours.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async readPercentSetting(
    key: string,
    envKey: string,
    defaultValue: number,
  ): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (row?.value?.trim()) {
      const parsed = Number(row.value.trim());
      if (Number.isFinite(parsed)) {
        return clampSharePercent(parsed);
      }
    }

    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) {
      const parsed = Number(fromEnv);
      if (Number.isFinite(parsed)) {
        return clampSharePercent(parsed);
      }
    }

    return defaultValue;
  }

  private async writePercentSetting(key: string, percent: number): Promise<number> {
    const safe = clampSharePercent(percent);
    if (!Number.isFinite(percent)) {
      throw new BadRequestException('percent must be a number between 0 and 100');
    }

    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: String(safe) },
      update: { value: String(safe) },
    });

    return safe;
  }

  async getDriverDeliverySharePercent(): Promise<number> {
    return this.readPercentSetting(
      DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
      'DRIVER_DELIVERY_FEE_SHARE_PERCENT',
      DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT,
    );
  }

  async getMerchantFoodSharePercent(): Promise<number> {
    return this.readPercentSetting(
      MERCHANT_FOOD_SHARE_PERCENT_KEY,
      'MERCHANT_FOOD_SHARE_PERCENT',
      DEFAULT_MERCHANT_FOOD_SHARE_PERCENT,
    );
  }

  /** Effective food-share % for a store (per-merchant override or global default). */
  async getMerchantFoodSharePercentForMerchant(
    merchantId: string,
  ): Promise<number> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { foodSharePercent: true },
    });
    if (merchant?.foodSharePercent != null) {
      return clampSharePercent(Number(merchant.foodSharePercent));
    }
    return this.getMerchantFoodSharePercent();
  }

  async setDriverDeliverySharePercent(percent: number): Promise<number> {
    return this.writePercentSetting(
      DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
      percent,
    );
  }

  async setMerchantFoodSharePercent(percent: number): Promise<number> {
    return this.writePercentSetting(MERCHANT_FOOD_SHARE_PERCENT_KEY, percent);
  }

  async getEarningsSettings() {
    const [driverDeliverySharePercent, merchantFoodSharePercent] =
      await Promise.all([
        this.getDriverDeliverySharePercent(),
        this.getMerchantFoodSharePercent(),
      ]);

    return {
      driverDeliverySharePercent,
      merchantFoodSharePercent,
      platformDeliverySharePercent: platformSharePercent(
        driverDeliverySharePercent,
      ),
      platformFoodSharePercent: platformSharePercent(merchantFoodSharePercent),
    };
  }

  async updateEarningsSettings(dto: UpdatePlatformEarningsDto) {
    if (
      dto.driverDeliverySharePercent === undefined &&
      dto.merchantFoodSharePercent === undefined
    ) {
      throw new BadRequestException(
        'Provide driverDeliverySharePercent and/or merchantFoodSharePercent',
      );
    }

    if (dto.driverDeliverySharePercent !== undefined) {
      await this.setDriverDeliverySharePercent(dto.driverDeliverySharePercent);
    }
    if (dto.merchantFoodSharePercent !== undefined) {
      await this.setMerchantFoodSharePercent(dto.merchantFoodSharePercent);
    }

    return this.getEarningsSettings();
  }

  private parseBoolSetting(raw: string | undefined, defaultValue: boolean): boolean {
    if (raw === undefined || raw.trim() === '') {
      return defaultValue;
    }
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private async readSetting(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const v = row?.value?.trim();
    return v ? v : null;
  }

  async getPlatformOperatingHours(): Promise<PlatformOperatingHours> {
    const [useRaw, tzRaw, openRaw, closeRaw] = await Promise.all([
      this.readSetting(PLATFORM_USE_OPERATING_HOURS_KEY),
      this.readSetting(PLATFORM_TIMEZONE_KEY),
      this.readSetting(PLATFORM_OPEN_LOCAL_KEY),
      this.readSetting(PLATFORM_CLOSE_LOCAL_KEY),
    ]);

    const useOperatingHours = this.parseBoolSetting(
      useRaw ?? process.env.PLATFORM_USE_OPERATING_HOURS,
      true,
    );
    const timezone =
      tzRaw?.trim() ||
      process.env.PLATFORM_TIMEZONE?.trim() ||
      MERCHANT_TIMEZONE_LEBANON;
    const openLocal =
      normalizeLocalTimeTo24h(
        openRaw ?? process.env.PLATFORM_OPEN_LOCAL ?? DEFAULT_PLATFORM_OPEN_LOCAL,
      ) ?? DEFAULT_PLATFORM_OPEN_LOCAL;
    const closeLocal =
      normalizeLocalTimeTo24h(
        closeRaw ??
          process.env.PLATFORM_CLOSE_LOCAL ??
          DEFAULT_PLATFORM_CLOSE_LOCAL,
      ) ?? DEFAULT_PLATFORM_CLOSE_LOCAL;

    return {
      useOperatingHours,
      timezone,
      openLocal,
      closeLocal,
    };
  }

  async getPlatformOperatingStatus(now?: Date): Promise<PlatformOperatingStatus> {
    const hours = await this.getPlatformOperatingHours();
    const isOpenNow = hours.useOperatingHours
      ? computePlatformOpenNow(hours, now)
      : true;
    return { ...hours, isOpenNow };
  }

  async assertPlatformOpenForOrders(now?: Date): Promise<void> {
    const status = await this.getPlatformOperatingStatus(now);
    if (!status.useOperatingHours || status.isOpenNow) {
      return;
    }
    throw new BadRequestException(
      `PipPip Delivery is closed. We are open daily from ${status.openLocal} until ${status.closeLocal} (next morning).`,
    );
  }

  async updatePlatformOperatingHours(dto: UpdatePlatformOperatingHoursDto) {
    if (dto.useOperatingHours !== undefined) {
      await this.prisma.appSetting.upsert({
        where: { key: PLATFORM_USE_OPERATING_HOURS_KEY },
        create: {
          key: PLATFORM_USE_OPERATING_HOURS_KEY,
          value: dto.useOperatingHours ? 'true' : 'false',
        },
        update: { value: dto.useOperatingHours ? 'true' : 'false' },
      });
    }

    if (dto.timezone !== undefined) {
      const tz = dto.timezone.trim();
      if (!isValidIanaTimeZone(tz)) {
        throw new BadRequestException('timezone must be a valid IANA name');
      }
      await this.prisma.appSetting.upsert({
        where: { key: PLATFORM_TIMEZONE_KEY },
        create: { key: PLATFORM_TIMEZONE_KEY, value: tz },
        update: { value: tz },
      });
    }

    if (dto.openLocal !== undefined) {
      const open = normalizeLocalTimeTo24h(dto.openLocal);
      if (!open) {
        throw new BadRequestException('openLocal must be HH:mm or h:mm AM/PM');
      }
      await this.prisma.appSetting.upsert({
        where: { key: PLATFORM_OPEN_LOCAL_KEY },
        create: { key: PLATFORM_OPEN_LOCAL_KEY, value: open },
        update: { value: open },
      });
    }

    if (dto.closeLocal !== undefined) {
      const close = normalizeLocalTimeTo24h(dto.closeLocal);
      if (!close) {
        throw new BadRequestException('closeLocal must be HH:mm or h:mm AM/PM');
      }
      await this.prisma.appSetting.upsert({
        where: { key: PLATFORM_CLOSE_LOCAL_KEY },
        create: { key: PLATFORM_CLOSE_LOCAL_KEY, value: close },
        update: { value: close },
      });
    }

    return this.getPlatformOperatingStatus();
  }
}
