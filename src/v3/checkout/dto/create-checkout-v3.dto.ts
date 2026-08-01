import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CreateCheckoutDto } from '../../../checkout/dto/create-checkout.dto';

export class CreateCheckoutV3Dto extends OmitType(CreateCheckoutDto, [
  'addressId',
  'latitude',
  'longitude',
] as const) {
  @ApiProperty({
    format: 'uuid',
    description:
      'Required saved address id (from POST /v3/users/me/addresses).',
  })
  @IsUUID()
  addressId!: string;

  @ApiPropertyOptional({
    description:
      'Optional delivery latitude. When omitted, server uses the saved address coordinates.',
    example: 32.8872,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Optional delivery longitude. When omitted, server uses the saved address coordinates.',
    example: 13.1913,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
