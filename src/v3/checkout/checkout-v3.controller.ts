import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtUserPayload } from '../../auth/jwt-user.payload';
import { UserAccountGuard } from '../../auth/user-account.guard';
import { CheckoutService } from '../../checkout/checkout.service';
import { CreateCheckoutV3Dto } from './dto/create-checkout-v3.dto';

/** V3 checkout requires a saved addressId and rejects inactive products. */
@ApiTags('V3 · Customer · Checkout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller({ path: 'checkout', version: '3' })
export class CheckoutV3Controller {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({
    summary:
      'Place order for one merchant (v3). Requires addressId; lat/lng optional (resolved from saved address). Inactive products cannot be ordered.',
    description:
      'Product options: send selectedChoiceIds on each line. Order the same product with different options as separate items (e.g. 2× Large in one item, 1× Small in another).',
  })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateCheckoutV3Dto,
  ) {
    return this.checkoutService.createOrder(req.user!.sub, dto, {
      requireActiveProducts: true,
      requireAddressId: true,
      resolveCoordinatesFromSavedAddress: true,
      validateSavedAddressCoordinates: true,
    });
  }
}
