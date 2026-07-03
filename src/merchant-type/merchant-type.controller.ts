import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateMerchantTypeDto } from './dto/create-merchant-type.dto';
import { UpdateMerchantTypeDto } from './dto/update-merchant-type.dto';
import { MerchantTypeService } from './merchant-type.service';
import { I18n, type I18nOptions } from '../common/i18n';

const MERCHANT_TYPE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

@Controller('merchant-types')
export class MerchantTypeController {
  constructor(
    private readonly merchantTypeService: MerchantTypeService,
    private readonly cloudinary: S3Service,
  ) {}

  @ApiTags('Shared')
  @ApiOperation({ summary: 'List active merchant types (for dropdowns)' })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    description: 'Response language (en or ar). Omit for bilingual fields.',
  })
  @Get()
  findAllPublic(@I18n() i18n?: I18nOptions) {
    return this.merchantTypeService.findAllPublic(i18n);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List all merchant types including inactive' })
  @Get('admin/all')
  findAllAdmin() {
    return this.merchantTypeService.findAllAdmin();
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary: 'Upload merchant type icon (super admin). Returns imageUrl for JSON create/update.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MERCHANT_TYPE_IMAGE_MAX_BYTES },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is required');
    }
    const imageUrl = await this.cloudinary.uploadImage(
      file.buffer,
      'athar/merchant-types',
    );
    return { imageUrl };
  }

  @ApiTags('Shared')
  @ApiOperation({ summary: 'Get one merchant type by id' })
  @ApiParam({ name: 'id', type: String })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantTypeService.findOne(id);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary: 'Create merchant type (super admin, JSON or multipart form fields)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MERCHANT_TYPE_IMAGE_MAX_BYTES },
    }),
  )
  async create(
    @Body() dto: CreateMerchantTypeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file?.buffer?.length) {
      dto.imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/merchant-types',
      );
    }
    return this.merchantTypeService.create(dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({
    summary: 'Update merchant type (super admin, JSON or multipart form fields)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MERCHANT_TYPE_IMAGE_MAX_BYTES },
    }),
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantTypeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file?.buffer?.length) {
      dto.imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/merchant-types',
      );
    }
    return this.merchantTypeService.update(id, dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({
    summary:
      'Delete merchant type (super admin). Removes the image from S3 when present.',
  })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantTypeService.remove(id);
  }
}
