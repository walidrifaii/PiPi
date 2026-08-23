import { BadRequestException, Injectable } from '@nestjs/common';
import { isValidIanaTimeZone } from '../common/merchant-open-status';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSpecialRequestSettingsDto } from './dto/update-special-request-settings.dto';
import {
  DEFAULT_SPECIAL_REQUEST_BUY_FEE,
  DEFAULT_SPECIAL_REQUEST_NOW_MAX_MINUTES,
  DEFAULT_SPECIAL_REQUEST_NOW_MIN_MINUTES,
  DEFAULT_SPECIAL_REQUEST_TIMEZONE,
} from './special-request.constants';

export type SpecialRequestSettingsView = {
  isEnabled: boolean;
  timezone: string;
  now: { minMinutes: number; maxMinutes: number };
  buyFee: number;
  serviceFee: number;
  updatedAt: string;
};

@Injectable()
export class SpecialRequestSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async ensureSettings() {
    const existing = await this.prisma.specialRequestSetting.findUnique({
      where: { id: 1 },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.specialRequestSetting.create({
      data: {
        id: 1,
        isEnabled: true,
        timezone: DEFAULT_SPECIAL_REQUEST_TIMEZONE,
        nowMinMinutes: DEFAULT_SPECIAL_REQUEST_NOW_MIN_MINUTES,
        nowMaxMinutes: DEFAULT_SPECIAL_REQUEST_NOW_MAX_MINUTES,
        buyFee: DEFAULT_SPECIAL_REQUEST_BUY_FEE,
      },
    });
  }

  async getSettings(): Promise<SpecialRequestSettingsView> {
    const row = await this.ensureSettings();
    const buyFee = this.roundMoney(Number(row.buyFee));
    return {
      isEnabled: row.isEnabled,
      timezone: row.timezone,
      now: {
        minMinutes: row.nowMinMinutes,
        maxMinutes: row.nowMaxMinutes,
      },
      buyFee,
      serviceFee: buyFee,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettings(
    dto: UpdateSpecialRequestSettingsDto,
  ): Promise<SpecialRequestSettingsView> {
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
    const timezone = dto.timezone?.trim() || current.timezone;
    if (!isValidIanaTimeZone(timezone)) {
      throw new BadRequestException('Invalid timezone');
    }

    await this.prisma.specialRequestSetting.update({
      where: { id: 1 },
      data: {
        isEnabled: dto.isEnabled ?? current.isEnabled,
        timezone,
        nowMinMinutes: nowMin,
        nowMaxMinutes: nowMax,
        buyFee:
          dto.buyFee !== undefined
            ? this.roundMoney(dto.buyFee)
            : current.buyFee,
      },
    });
    return this.getSettings();
  }
}
