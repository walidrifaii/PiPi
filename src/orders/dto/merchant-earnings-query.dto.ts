import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class MerchantEarningsQueryDto {
  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
    description: 'Period start (ISO). Defaults to start of current month.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
    description: 'Period end (ISO). Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
