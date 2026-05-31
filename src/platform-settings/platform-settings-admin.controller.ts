import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { UpdateDriverDeliveryShareDto } from './dto/update-driver-delivery-share.dto';
import { UpdatePlatformEarningsDto } from './dto/update-platform-earnings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/settings')
export class PlatformSettingsAdminController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @ApiOperation({
    summary:
      'Earnings split: driver % of delivery fee, merchant % of food subtotal',
  })
  @Get('earnings')
  getEarningsSettings() {
    return this.settings.getEarningsSettings();
  }

  @ApiOperation({
    summary: 'Update driver and/or merchant earnings percentages (0–100)',
  })
  @Patch('earnings')
  updateEarningsSettings(@Body() dto: UpdatePlatformEarningsDto) {
    return this.settings.updateEarningsSettings(dto);
  }

  @ApiOperation({
    summary:
      'Get driver delivery-fee share % (driver earnings = deliveryFee × percent / 100)',
  })
  @Get('driver-delivery-share')
  getDriverDeliveryShare() {
    return this.settings.getDriverDeliverySharePercent().then((percent) => ({
      driverDeliverySharePercent: percent,
    }));
  }

  @ApiOperation({
    summary: 'Update driver delivery-fee share % (0–100)',
  })
  @Patch('driver-delivery-share')
  async updateDriverDeliveryShare(@Body() dto: UpdateDriverDeliveryShareDto) {
    const percent = await this.settings.setDriverDeliverySharePercent(
      dto.percent,
    );
    return { driverDeliverySharePercent: percent };
  }
}
