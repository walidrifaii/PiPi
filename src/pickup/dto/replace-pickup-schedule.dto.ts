import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PickupScheduleIntervalDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @MaxLength(16)
  start!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @MaxLength(16)
  end!: string;
}

export class PickupScheduleDayDto {
  @ApiProperty({
    description: 'ISO weekday 1–7 or English name (Monday / Mon)',
    example: 'Monday',
  })
  @IsDefined()
  weekday!: string | number;

  @ApiProperty({ type: [PickupScheduleIntervalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupScheduleIntervalDto)
  slots!: PickupScheduleIntervalDto[];
}

export class ReplacePickupScheduleDto {
  @ApiProperty({ type: [PickupScheduleDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupScheduleDayDto)
  days!: PickupScheduleDayDto[];
}
