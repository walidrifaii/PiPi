import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { I18n, type I18nOptions } from '../common/i18n';
import { BannerService } from './banner.service';

@ApiTags('Storefront')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @ApiOperation({
    summary: 'List active banners for the home carousel (public)',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    description: 'Response language (en or ar). Omit for bilingual title fields.',
  })
  @Get()
  findActive(@I18n() i18n?: I18nOptions) {
    return this.bannerService.findActivePublic(i18n);
  }
}
