import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('Shared')
@Controller('platform')
export class PlatformOperatingController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @ApiOperation({
    summary:
      'App open/closed status (default: open 9:00 AM – 1:00 AM next day, Asia/Beirut)',
  })
  @Get('operating-status')
  getOperatingStatus() {
    return this.settings.getPlatformOperatingStatus();
  }
}
