import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';

@ApiTags('Storefront')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @ApiOperation({
    summary: 'List active banners for the home carousel (public)',
  })
  @Get()
  findActive() {
    return this.bannerService.findActivePublic();
  }
}
