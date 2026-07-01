import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({
    description: 'Coupon code to validate (case-insensitive).',
    example: 'SUMMER20',
  })
  @IsString()
  @MaxLength(50)
  code: string;
}
