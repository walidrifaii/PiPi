import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserAccountGuard } from '../auth/user-account.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { S3Service } from '../common/s3.service';
import {
  PickupCoverageQueryDto,
  QuotePickupQueryDto,
} from '../pickup/dto/pickup-query.dto';
import { PickupBlockedZoneService } from '../pickup/pickup-blocked-zone.service';
import { CreateSpecialRequestDto } from './dto/create-special-request.dto';
import { SPECIAL_REQUEST_IMAGE_MAX_BYTES } from './special-request.constants';
import { SpecialRequestService } from './special-request.service';

@ApiTags('V3 · Customer · Special Request')
@Controller('special-requests')
export class SpecialRequestController {
  constructor(
    private readonly specialRequests: SpecialRequestService,
    private readonly blocked: PickupBlockedZoneService,
    private readonly s3: S3Service,
  ) {}

  @ApiOperation({
    summary:
      'NOW window and the super-admin fixed buy/service fee. Fast-only, no schedule.',
  })
  @Get('config')
  getConfig() {
    return this.specialRequests.getPublicConfig();
  }

  @ApiOperation({
    summary:
      'Check whether a pin is inside a pickup blocked polygon. If allowed=false the user cannot use this place.',
  })
  @Get('coverage')
  coverage(@Query() query: PickupCoverageQueryDto) {
    return this.blocked.checkPoint(query.lat, query.lng, query.role ?? 'to');
  }

  @ApiOperation({
    summary:
      'Confirm the route is allowed and return the fixed buy/service fee (no distance pricing).',
  })
  @Get('quote')
  quote(@Query() query: QuotePickupQueryDto) {
    return this.specialRequests.quote(
      query.fromLat,
      query.fromLng,
      query.toLat,
      query.toLng,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({ summary: 'Upload one product image. Returns { imageUrl }.' })
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
      limits: { fileSize: SPECIAL_REQUEST_IMAGE_MAX_BYTES },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is required');
    }
    const imageUrl = await this.s3.uploadImage(
      file.buffer,
      'athar/special-requests',
    );
    return { imageUrl };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({
    summary:
      'Create a fast (NOW) special request. Requires storeName, itemName, productImageUrl, from/to, and serviceFee matching the fixed buy fee.',
  })
  @Post()
  create(
    @Req() req: { user: JwtUserPayload },
    @Body() dto: CreateSpecialRequestDto,
  ) {
    return this.specialRequests.create(req.user.sub, dto);
  }
}
