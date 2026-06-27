import {
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { S3Service } from '../common/s3.service';
import { CreateMerchantTypeDto } from './dto/create-merchant-type.dto';
import { UpdateMerchantTypeDto } from './dto/update-merchant-type.dto';
import { MerchantTypeService } from './merchant-type.service';

@Controller('merchant-types')
export class MerchantTypeController {
  constructor(
    private readonly merchantTypeService: MerchantTypeService,
    private readonly cloudinary: S3Service,
  ) {}

  @ApiTags('Shared')
  @ApiOperation({ summary: 'List active merchant types (for dropdowns)' })
  @Get()
  findAllPublic() {
    return this.merchantTypeService.findAllPublic();
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List all merchant types including inactive' })
  @Get('admin/all')
  findAllAdmin() {
    return this.merchantTypeService.findAllAdmin();
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
    summary: 'Create merchant type (super admin, optional image upload)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'name'],
      properties: {
        code: { type: 'string', example: 'BAKERY' },
        name: { type: 'string', example: 'Bakery' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer', minimum: 0 },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Type icon / image',
        },
      },
    },
  })
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateMerchantTypeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/merchant-types',
      );
    }
    return this.merchantTypeService.create(dto, imageUrl);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({
    summary:
      'Update merchant type (super admin). Optional image replaces the previous file on Cloudinary.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer', minimum: 0 },
        image: {
          type: 'string',
          format: 'binary',
          description: 'New type icon / image (optional)',
        },
      },
    },
  })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantTypeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/merchant-types',
      );
    }
    return this.merchantTypeService.update(id, dto, imageUrl);
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
