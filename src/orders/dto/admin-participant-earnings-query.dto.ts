import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class AdminDriverEarningsQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month', 'all'],
    default: 'month',
    description: 'Earnings window (all = last 90 days)',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'all'])
  period?: string;
}
