import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

type MerchantTypeFields = {
  merchantTypeId?: string;
  merchantTypeCode?: string;
};

@ValidatorConstraint({ name: 'MerchantTypeIdOrCode', async: false })
class MerchantTypeIdOrCodeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as MerchantTypeFields;
    return Boolean(o.merchantTypeId?.trim() || o.merchantTypeCode?.trim());
  }

  defaultMessage(): string {
    return 'Provide merchantTypeId (UUID from GET /merchant-types) or merchantTypeCode (e.g. SUPERMARKET)';
  }
}

/** Form fields for POST /auth/merchant/register (use multipart/form-data; files `logo` and `cover` are separate). */
export class RegisterMerchantDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Store / business display name' })
  @IsString()
  @MaxLength(255)
  @Validate(MerchantTypeIdOrCodeConstraint)
  merchantName: string;

  @ApiPropertyOptional({ description: 'Arabic store / business display name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  merchantNameAr?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Merchant type id from GET /merchant-types on this server. Omit if merchantTypeCode is set.',
  })
  @IsOptional()
  @IsUUID('4')
  merchantTypeId?: string;

  @ApiPropertyOptional({
    example: 'SUPERMARKET',
    description:
      'Merchant type code (case-insensitive). Alternative to merchantTypeId when the UUID is unknown.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  merchantTypeCode?: string;

  @ApiPropertyOptional({
    example: 'TRIPOLI',
    description: 'Service area code for catalog filtering (stored uppercase)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityCode?: string;

  @ApiPropertyOptional({ description: 'Store latitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Store longitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
