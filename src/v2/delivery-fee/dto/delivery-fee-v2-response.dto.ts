import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryFeeV2RatesDto {
  @ApiProperty({ example: 1.5 })
  fixedFee: number;

  @ApiProperty({ example: 1 })
  kmUnit: number;

  @ApiProperty({ example: 1 })
  feePerUnit: number;
}

export class DeliveryFeeV2LimitsDto {
  @ApiProperty({
    example: 10,
    description: 'Km included in fixedFee (no extra charge inside this radius).',
  })
  includedKm: number;

  @ApiProperty({
    example: 30,
    description: 'Bill using at most this many km.',
  })
  maxKm: number;

  @ApiProperty({
    example: 15,
    description: 'Maximum total delivery charge.',
  })
  maxFee: number;
}

export class DeliveryFeeV2BreakdownDto {
  @ApiProperty({ example: 3.5 })
  deliveryFee: number;

  @ApiProperty({ example: 3.5 })
  billedKm: number;

  @ApiProperty({ type: DeliveryFeeV2RatesDto })
  rates: DeliveryFeeV2RatesDto;

  @ApiProperty({ type: DeliveryFeeV2LimitsDto })
  limits: DeliveryFeeV2LimitsDto;
}

export class DeliveryFeeV2ActiveConfigDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiPropertyOptional({ example: 'Default city rate' })
  name: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ type: DeliveryFeeV2RatesDto })
  rates: DeliveryFeeV2RatesDto;

  @ApiProperty({ type: DeliveryFeeV2LimitsDto })
  limits: DeliveryFeeV2LimitsDto;

  @ApiPropertyOptional({ type: DeliveryFeeV2BreakdownDto })
  sampleBreakdown: DeliveryFeeV2BreakdownDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class DeliveryFeeV2ActiveResponseDto {
  @ApiProperty({ example: 2 })
  apiVersion: 2;

  @ApiProperty({ type: DeliveryFeeV2ActiveConfigDto })
  config: DeliveryFeeV2ActiveConfigDto;
}
