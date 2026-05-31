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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CloudinaryService } from '../common/cloudinary.service';
import { CreateMerchantOfferAdminDto } from './dto/create-merchant-offer-admin.dto';
import { UpdateMerchantOfferAdminDto } from './dto/update-merchant-offer-admin.dto';
import { MerchantOfferService } from './merchant-offer.service';

@ApiTags('Super Admin · Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('merchants/admin/offers')
export class MerchantOfferAdminController {
  constructor(
    private readonly offers: MerchantOfferService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @ApiOperation({
    summary: 'List all merchant promos (super admin)',
    description:
      'Display-only offers shown to customers. Checkout always uses each product list/discount price.',
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
    summary: 'Create merchant promo (super admin, pick merchant + image)',
    description:
      'Promo is shown on the customer app only. Product prices at checkout are unchanged unless the merchant set per-product discount_price.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['merchantId', 'image', 'discountPercent', 'endsAt'],
      properties: {
        merchantId: { type: 'string', format: 'uuid' },
        image: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        discountPercent: { type: 'number', example: 10 },
        endsAt: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateMerchantOfferAdminDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const buffer = this.offers.requireImageFile(file);
    const imageUrl = await this.cloudinary.uploadImage(
      buffer,
      'athar/merchant-offers',
    );
    return this.offers.createForAdmin(dto, imageUrl);
  }

  @ApiOperation({ summary: 'Update merchant promo (super admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        merchantId: { type: 'string', format: 'uuid' },
        image: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        discountPercent: { type: 'number' },
        endsAt: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Patch(':offerId')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateMerchantOfferAdminDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/merchant-offers',
      );
    }
    return this.offers.updateForAdmin(offerId, dto, imageUrl);
  }

  @ApiOperation({ summary: 'Delete merchant promo (super admin)' })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Delete(':offerId')
  remove(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.removeForAdmin(offerId);
  }
}
