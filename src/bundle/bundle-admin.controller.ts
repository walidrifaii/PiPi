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
import { S3Service } from '../common/s3.service';
import { BundleService } from './bundle.service';
import { CreateBundleAdminDto } from './dto/create-bundle-admin.dto';
import { UpdateBundleAdminDto } from './dto/update-bundle-admin.dto';

@ApiTags('Super Admin · Bundles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('merchants/admin/bundles')
export class BundleAdminController {
  constructor(
    private readonly bundles: BundleService,
    private readonly s3: S3Service,
  ) {}

  @ApiOperation({
    summary: 'List all bundles (super admin, paginated)',
    description: 'Each item includes merchant id, name, and logo.',
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
    return this.bundles.listAllAdmin(page, limit, merchantId);
  }

  @ApiOperation({ summary: 'Get one bundle by id (super admin)' })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Get(':bundleId')
  getOne(@Param('bundleId', ParseUUIDPipe) bundleId: string) {
    return this.bundles.findOneAdmin(bundleId);
  }

  @ApiOperation({
    summary: 'Create bundle for a merchant (super admin)',
    description: 'Multipart: image required. Super admin is not limited to 5 bundles.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['merchantId', 'title', 'price', 'image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        merchantId: { type: 'string', format: 'uuid' },
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
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateBundleAdminDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const buffer = this.bundles.requireImageFile(file);
    const imageUrl = await this.s3.uploadImage(buffer, 'athar/bundles');
    return this.bundles.createForAdmin(dto, imageUrl);
  }

  @ApiOperation({
    summary: 'Update bundle (super admin)',
    description: 'Activate/deactivate, change merchant, or replace image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        merchantId: { type: 'string', format: 'uuid' },
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
  @Patch(':bundleId')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
    @Body() dto: UpdateBundleAdminDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.s3.uploadImage(file.buffer, 'athar/bundles');
    }
    return this.bundles.updateForAdmin(bundleId, dto, imageUrl);
  }

  @ApiOperation({ summary: 'Delete bundle (super admin)' })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Delete(':bundleId')
  remove(@Param('bundleId', ParseUUIDPipe) bundleId: string) {
    return this.bundles.removeForAdmin(bundleId);
  }
}
