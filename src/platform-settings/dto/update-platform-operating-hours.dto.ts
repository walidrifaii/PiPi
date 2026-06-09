import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformOperatingHoursDto {
  @ApiPropertyOptional({
    description:
      'When true, orders are only accepted during openLocal–closeLocal (close may be next morning).',
  })
  @IsOptional()
  @IsBoolean()
  useOperatingHours?: boolean;

  @ApiPropertyOptional({ example: 'Asia/Beirut' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    example: '09:00',
    description: 'Daily open time in platform timezone (24h or AM/PM).',
  })
  @IsOptional()
  @IsString()
  openLocal?: string;

  @ApiPropertyOptional({
    example: '01:00',
    description:
      'Daily close time in platform timezone. If earlier than openLocal, closes the next calendar day (e.g. 9 AM → 1 AM).',
  })
  @IsOptional()
  @IsString()
  closeLocal?: string;
}
