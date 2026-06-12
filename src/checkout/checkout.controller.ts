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
  constructor(protected readonly checkoutService: CheckoutService) {}

  @ApiOperation({
    summary:
      'Place order for one merchant. Client sends deliveryFee (from quote) + items; server computes subtotal, total, and merchant amounts.',
  })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createOrder(req.user!.sub, dto);
  }
}
