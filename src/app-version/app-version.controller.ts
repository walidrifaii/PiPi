import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppVersionService } from './app-version.service';

@ApiTags('Shared')
@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @ApiOperation({
    summary:
      'Get current app version info — latestVersion, minVersion, androidUrl, iosUrl. ' +
      'Mobile app should force-update when installed version < minVersion.',
  })
  @Get()
  getAppVersion() {
    return this.appVersionService.getAppVersion();
  }
}
