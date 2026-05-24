import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MerchantJwtScopeGuard } from './merchant-jwt-scope.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { EffectiveMerchantId } from './effective-merchant-id.decorator';
import { OptionalFcmTokenDto } from './dto/optional-fcm-token.dto';
import { AuthService } from './auth.service';
import type { JwtUserPayload } from './jwt-user.payload';

@ApiTags('Notifications')
@Controller()
export class FcmTokenController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Save FCM device token for the logged-in merchant (web/mobile dashboard)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
  @Patch('merchants/me/fcm-token')
  setMerchantFcmToken(
    @EffectiveMerchantId() merchantId: string,
    @Body() dto: OptionalFcmTokenDto,
  ) {
    return this.authService.setMerchantFcmToken(merchantId, dto.fcmToken);
  }

  @ApiOperation({
    summary: 'Save FCM device token for the logged-in super admin',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch('admin/me/fcm-token')
  setSuperAdminFcmToken(
    @Req() req: { user: JwtUserPayload },
    @Body() dto: OptionalFcmTokenDto,
  ) {
    return this.authService.setSuperAdminFcmToken(req.user.sub, dto.fcmToken);
  }
}
