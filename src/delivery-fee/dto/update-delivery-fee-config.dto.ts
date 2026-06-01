import { PartialType } from '@nestjs/swagger';
import { CreateDeliveryFeeConfigDto } from './create-delivery-fee-config.dto';

export class UpdateDeliveryFeeConfigDto extends PartialType(
  CreateDeliveryFeeConfigDto,
) {}
