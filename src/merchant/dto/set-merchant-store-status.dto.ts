import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum MerchantStoreStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export function merchantIsActiveFromStoreStatus(
  status: MerchantStoreStatus,
): boolean {
  return status === MerchantStoreStatus.OPEN;
}

export class SetMerchantStoreStatusDto {
  @ApiProperty({
    enum: MerchantStoreStatus,
    example: MerchantStoreStatus.OPEN,
    description: 'OPEN = store visible and accepting catalog/orders rules; CLOSED = off',
  })
  @IsEnum(MerchantStoreStatus)
  status: MerchantStoreStatus;
}
