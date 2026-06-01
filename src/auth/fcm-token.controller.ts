import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MerchantJwtScopeGuard } from './merchant-jwt-scope.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { DriverAccountGuard } from './driver-account.guard';
import { UserAccountGuard } from './user-account.guard';
import { EffectiveMerchantId } from './effective-merchant-id.decorator';
import { OptionalFcmTokenDto } from './dto/optional-fcm-token.dto';
import { AuthService } from './auth.service';
import type { JwtUserPayload } from './jwt-user.payload';

@ApiTags('Notifications')
@Controller()
export class FcmTokenController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary:
      'Save FCM device token for the logged-in customer (required for push + broadcasts)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @Patch('user/me/fcm-token')
  setUserFcmToken(
    @Req() req: { user: JwtUserPayload },
    @Body() dto: OptionalFcmTokenDto,
  ) {
    return this.authService.setUserFcmToken(req.user.sub, dto.fcmToken);
  }

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

  @ApiOperation({
    summary: 'Save FCM device token for the logged-in driver',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @Patch('drivers/me/fcm-token')
  setDriverFcmToken(
    @Req() req: { user: JwtUserPayload },
    @Body() dto: OptionalFcmTokenDto,
  ) {
    return this.authService.setDriverFcmToken(req.user.sub, dto.fcmToken);
  }
}
