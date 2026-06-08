import { Injectable } from '@nestjs/common';
import { haversineDistanceKm } from '../../common/haversine';
import {
  DeliveryFeeService,
  type DeliveryFeeConfigItem,
} from '../../delivery-fee/delivery-fee.service';
import { QuoteDeliveryFeeQueryDto } from '../../delivery-fee/dto/quote-delivery-fee-query.dto';
import type {
  DeliveryFeeV2ActiveResponseDto,
  DeliveryFeeV2BreakdownDto,
  DeliveryFeeV2QuoteResponseDto,
} from './dto/delivery-fee-v2-response.dto';

type V1QuoteResult = {
  configId?: string | null;
  fixedFee: number;
  includedKm: number;
  kmUnit: number;
  feePerUnit: number;
  maxFee: number;
  maxKm: number;
  deliveryFee: number;
};

@Injectable()
export class DeliveryFeeV2Service {
  constructor(private readonly deliveryFees: DeliveryFeeService) {}

  private toBreakdown(
    row: V1QuoteResult,
    billedKm: number,
  ): DeliveryFeeV2BreakdownDto {
    return {
      deliveryFee: row.deliveryFee,
      billedKm,
      rates: {
        fixedFee: row.fixedFee,
        kmUnit: row.kmUnit,
        feePerUnit: row.feePerUnit,
      },
      limits: {
        includedKm: row.includedKm,
        maxKm: row.maxKm,
        maxFee: row.maxFee,
      },
    };
  }

  private billedKmFromQuote(row: V1QuoteResult, distanceKm?: number): number {
    if (distanceKm !== undefined && Number.isFinite(distanceKm)) {
      return Math.min(Math.max(distanceKm, 0), row.maxKm);
    }
    return row.maxKm;
  }

  private mapActiveConfig(
    config: DeliveryFeeConfigItem,
  ): DeliveryFeeV2ActiveResponseDto {
    const sampleBreakdown = config.sampleBreakdown
      ? this.toBreakdown(
          config.sampleBreakdown,
          Math.min(5, config.sampleBreakdown.maxKm),
        )
      : null;

    return {
      apiVersion: 2,
      config: {
        id: config.id,
        name: config.name,
        isActive: config.isActive,
        sortOrder: config.sortOrder,
        rates: {
          fixedFee: config.fixedFee,
          kmUnit: config.kmUnit,
          feePerUnit: config.feePerUnit,
        },
        limits: {
          includedKm: config.includedKm,
          maxKm: config.maxKm,
          maxFee: config.maxFee,
        },
        sampleBreakdown,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    };
  }

  getActiveConfig(): Promise<DeliveryFeeV2ActiveResponseDto> {
    return this.deliveryFees
      .getActiveConfig()
      .then((config) => this.mapActiveConfig(config));
  }

  async quote(
    query: QuoteDeliveryFeeQueryDto,
  ): Promise<DeliveryFeeV2QuoteResponseDto> {
    let distanceKm = query.distanceKm;

    if (
      distanceKm === undefined &&
      query.fromLat !== undefined &&
      query.fromLng !== undefined &&
      query.toLat !== undefined &&
      query.toLng !== undefined
    ) {
      distanceKm = haversineDistanceKm(
        query.fromLat,
        query.fromLng,
        query.toLat,
        query.toLng,
      );
    }

    const result = (await this.deliveryFees.quote(query)) as V1QuoteResult;
    const billedKm = this.billedKmFromQuote(result, distanceKm);

    return {
      apiVersion: 2,
      configId: result.configId ?? null,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
      quote: this.toBreakdown(result, billedKm),
    };
  }
}
