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
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { S3Service } from '../common/s3.service';
import { BundleService } from './bundle.service';
import { CreateBundleMerchantDto } from './dto/create-bundle-merchant.dto';
import { UpdateBundleMerchantDto } from './dto/update-bundle-merchant.dto';

/**
 * Must use `@Controller('merchants')` + `me/bundles` (not `merchants/me/bundles`)
 * so Nest registers a static path sibling to public `:merchantId/bundles`.
 * Register this controller before BundleMerchantPublicController in AppModule.
 */
@ApiTags('Merchant')
@ApiBearerAuth()
@Controller('merchants')
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
export class BundleMerchantController {
  constructor(
    private readonly bundles: BundleService,
    private readonly s3: S3Service,
  ) {}

  @ApiOperation({
    summary: 'List your store bundles (paginated)',
    description: 'Maximum 5 bundles per merchant.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('me/bundles')
  listMine(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.bundles.listForMerchant(merchantId, page, limit);
  }

  @ApiOperation({ summary: 'Get one of your bundles by id' })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Get('me/bundles/:bundleId')
  getOne(
    @EffectiveMerchantId() merchantId: string,
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
  ) {
    return this.bundles.findOneForMerchant(merchantId, bundleId);
  }

  @ApiOperation({
    summary: 'Create a bundle (max 5 per store)',
    description: 'Multipart: image file required. Set isActive=false to save as inactive.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'price', 'image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        titleAr: { type: 'string' },
        description: { type: 'string' },
        descriptionAr: { type: 'string' },
        price: { type: 'number', minimum: 0.01 },
        isActive: { type: 'boolean', default: true },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
  })
  @Post('me/bundles')
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @EffectiveMerchantId() merchantId: string,
    @Body() dto: CreateBundleMerchantDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const buffer = this.bundles.requireImageFile(file);
    const imageUrl = await this.s3.uploadImage(buffer, 'athar/bundles');
    return this.bundles.createForMerchant(merchantId, dto, imageUrl);
  }

  @ApiOperation({
    summary: 'Update your bundle (optional new image, activate/deactivate)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        titleAr: { type: 'string' },
        description: { type: 'string' },
        descriptionAr: { type: 'string' },
        price: { type: 'number', minimum: 0.01 },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Patch('me/bundles/:bundleId')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @EffectiveMerchantId() merchantId: string,
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
    @Body() dto: UpdateBundleMerchantDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.s3.uploadImage(file.buffer, 'athar/bundles');
    }
    return this.bundles.updateForMerchant(
      merchantId,
      bundleId,
      dto,
      imageUrl,
    );
  }

  @ApiOperation({ summary: 'Delete your bundle' })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Delete('me/bundles/:bundleId')
  remove(
    @EffectiveMerchantId() merchantId: string,
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
  ) {
    return this.bundles.removeForMerchant(merchantId, bundleId);
  }
}
