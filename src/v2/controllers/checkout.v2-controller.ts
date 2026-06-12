import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtUserPayload } from '../../auth/jwt-user.payload';
import { UserAccountGuard } from '../../auth/user-account.guard';
import { CheckoutController } from '../../checkout/checkout.controller';
import { CheckoutService } from '../../checkout/checkout.service';
import { CreateCheckoutDto } from '../../checkout/dto/create-checkout.dto';

/** V2 checkout rejects orders that include inactive products. */
@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller({ path: 'checkout', version: '2' })
export class CheckoutV2Controller extends CheckoutController {
  constructor(checkoutService: CheckoutService) {
    super(checkoutService);
  }

  @ApiOperation({
    summary:
      'Place order for one merchant. Inactive products cannot be ordered (v2).',
  })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createOrder(req.user!.sub, dto, {
      requireActiveProducts: true,
    });
  }
}
