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
import { CloudinaryService } from '../common/cloudinary.service';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@ApiTags('Super Admin · Banners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('banners/admin')
export class BannerAdminController {
  constructor(
    private readonly bannerService: BannerService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @ApiOperation({ summary: 'List all banners (super admin)' })
  @Get()
  findAll() {
    return this.bannerService.findAllAdmin();
  }

  @ApiOperation({ summary: 'Get one banner by id (super admin)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannerService.findOneAdmin(id);
  }

  @ApiOperation({
    summary: 'Create banner (super admin, multipart image required)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Banner image',
        },
        isActive: {
          type: 'boolean',
          description: 'ACTIVE when true (default true)',
        },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
  })
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const buffer = this.bannerService.requireImageFile(file);
    const imageUrl = await this.cloudinary.uploadImage(buffer, 'athar/banners');
    return this.bannerService.create(dto, imageUrl);
  }

  @ApiOperation({
    summary:
      'Update banner image and/or status (super admin). Omit image to keep current file. Replacing the image deletes the previous file from Cloudinary.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'New banner image (optional)',
        },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer?.length) {
      imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/banners',
      );
    }
    return this.bannerService.update(id, dto, imageUrl);
  }

  @ApiOperation({
    summary:
      'Delete banner (super admin). Removes the row and deletes the image from Cloudinary when hosted on this cloud.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannerService.remove(id);
  }
}
