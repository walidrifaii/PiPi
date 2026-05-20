import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMerchantDeliveryTimeDto } from './dto/upsert-merchant-delivery-time.dto';

export type MerchantDeliveryTimeResponse = {
  id: string;
  merchantId: string;
  minMinutes: number;
  maxMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MerchantDeliveryTimeService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(row: {
    id: string;
    merchantId: string;
    minMinutes: number;
    maxMinutes: number;
    createdAt: Date;
    updatedAt: Date;
  }): MerchantDeliveryTimeResponse {
    return {
      id: row.id,
      merchantId: row.merchantId,
      minMinutes: row.minMinutes,
      maxMinutes: row.maxMinutes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getForMerchant(
    merchantId: string,
  ): Promise<MerchantDeliveryTimeResponse | null> {
    const row = await this.prisma.merchantDeliveryTime.findUnique({
      where: { merchantId },
    });
    return row ? this.mapRow(row) : null;
  }

  async upsertForMerchant(
    merchantId: string,
    dto: UpsertMerchantDeliveryTimeDto,
  ): Promise<MerchantDeliveryTimeResponse> {
    const row = await this.prisma.merchantDeliveryTime.upsert({
      where: { merchantId },
      create: {
        merchantId,
        minMinutes: dto.minMinutes,
        maxMinutes: dto.maxMinutes,
      },
      update: {
        minMinutes: dto.minMinutes,
        maxMinutes: dto.maxMinutes,
      },
    });
    return this.mapRow(row);
  }
}
