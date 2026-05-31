import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CreateMerchantOfferAdminDto } from './dto/create-merchant-offer-admin.dto';
import { UpdateMerchantOfferAdminDto } from './dto/update-merchant-offer-admin.dto';
import { MerchantOfferService } from './merchant-offer.service';

@ApiTags('Super Admin · Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('merchants/admin/offers')
export class MerchantOfferAdminController {
  constructor(private readonly offers: MerchantOfferService) {}

  @ApiOperation({
    summary: 'List all merchant promos (super admin)',
    description:
      'Display-only offers shown to customers. Card image comes from the merchant cover/logo.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'merchantId',
    required: false,
    type: String,
    description: 'Filter by store',
  })
  @Get()
  listAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.offers.listAllAdmin(page, limit, merchantId);
  }

  @ApiOperation({ summary: 'Get one merchant promo (super admin)' })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Get(':offerId')
  getOne(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.findOneAdmin(offerId);
  }

  @ApiOperation({
    summary: 'Create merchant promo (super admin, pick merchant)',
    description:
      'Promo card uses the merchant cover image (or logo). Product prices at checkout are unchanged unless the merchant set per-product discount_price.',
  })
  @ApiBody({ type: CreateMerchantOfferAdminDto })
  @Post()
  create(@Body() dto: CreateMerchantOfferAdminDto) {
    return this.offers.createForAdmin(dto);
  }

  @ApiOperation({ summary: 'Update merchant promo (super admin)' })
  @ApiBody({ type: UpdateMerchantOfferAdminDto })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Patch(':offerId')
  update(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateMerchantOfferAdminDto,
  ) {
    return this.offers.updateForAdmin(offerId, dto);
  }

  @ApiOperation({ summary: 'Delete merchant promo (super admin)' })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Delete(':offerId')
  remove(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.removeForAdmin(offerId);
  }
}
