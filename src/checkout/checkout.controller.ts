import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { UserAccountGuard } from '../auth/user-account.guard';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({
    summary:
      'Place order for one merchant. Client sends merchantName, subtotal, total, distanceKm, deliveryTimeMinutes, latitude, longitude. Subtotal and total are validated against server pricing (line items + delivery); server values are stored.',
  })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createOrder(req.user!.sub, dto);
  }
}
