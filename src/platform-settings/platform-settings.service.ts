import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  clampSharePercent,
  DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT,
  DEFAULT_MERCHANT_FOOD_SHARE_PERCENT,
  DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY,
  MERCHANT_FOOD_SHARE_PERCENT_KEY,
  platformSharePercent,
} from './driver-delivery-share';
import { UpdatePlatformEarningsDto } from './dto/update-platform-earnings.dto';

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
}
