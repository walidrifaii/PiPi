import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/** @deprecated Prefer PATCH /merchants/me/status with `{ "status": "OPEN" | "CLOSED" }`. */
export class SetMerchantActiveDto {
  @ApiProperty({
    description: 'true = open store, false = close store',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  isActive: boolean;
}
