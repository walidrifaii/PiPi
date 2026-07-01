import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserAccountGuard } from '../auth/user-account.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('coupons')
export class CouponPublicController {
  constructor(private readonly coupons: CouponService) {}

  @Post('validate')
  @ApiOperation({
    summary: 'Validate a coupon code for the authenticated user',
    description: `
Checks that the coupon:
- exists and is active
- has not expired
- has not exceeded its usage limit
- has not already been used by this user

Returns \`{ valid: true, discountPercent, ... }\` or \`{ valid: false, reason }\`.

**Note:** The rule that coupons are blocked when cart items already carry a
product-level discount is enforced at checkout time (not here), because the cart
is not available at validation time.
    `.trim(),
  })
  validate(
    @Request() req: { user: JwtUserPayload },
    @Body() dto: ValidateCouponDto,
  ) {
    return this.coupons.validateForUser(req.user.sub, dto.code);
  }
}
