import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateCheckoutDto } from '../../../checkout/dto/create-checkout.dto';

export class CreateCheckoutV3Dto extends OmitType(CreateCheckoutDto, [
  'addressId',
] as const) {
  @ApiProperty({
    format: 'uuid',
    description:
      'Required saved address id (from POST /v3/users/me/addresses). lat/lng must match the saved address.',
  })
  @IsUUID()
  addressId!: string;
}
