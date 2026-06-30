import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { AppVersionService } from './app-version.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/app-version')
export class AppVersionAdminController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @ApiOperation({ summary: 'Get current app version config' })
  @Get()
  getAppVersion() {
    return this.appVersionService.getAppVersion();
  }

  @ApiOperation({
    summary:
      'Update app version config — set latestVersion, minVersion, androidUrl, iosUrl. ' +
      'Only provided fields are updated.',
  })
  @Patch()
  updateAppVersion(@Body() dto: UpdateAppVersionDto) {
    return this.appVersionService.updateAppVersion(dto);
  }
}
