import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CloudinaryService } from '../common/cloudinary.service';
import { AuthService } from './auth.service';
import { LoginMerchantDto } from './dto/login-merchant.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';

@ApiTags('Merchant auth')
@Controller('auth')
export class AuthMerchantController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @ApiOperation({
    summary:
      'Register a new merchant (multipart/form-data: logo + cover images required) and return JWT',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Store credentials with logo (avatar) and cover (banner) images uploaded as files.',
    schema: {
      type: 'object',
      required: ['email', 'phone', 'password', 'merchantName', 'logo', 'cover'],
      properties: {
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', minLength: 5, maxLength: 50 },
        password: { type: 'string', minLength: 8 },
        merchantName: {
          type: 'string',
          maxLength: 255,
          description: 'Store / business display name',
        },
        merchantTypeId: {
          type: 'string',
          format: 'uuid',
          description:
            'Merchant type UUID from GET /merchant-types on this server. Optional if merchantTypeCode is sent.',
        },
        merchantTypeCode: {
          type: 'string',
          example: 'SUPERMARKET',
          description:
            'Alternative to merchantTypeId (e.g. SUPERMARKET, RESTAURANT). Case-insensitive.',
        },
        cityCode: {
          type: 'string',
          example: 'TRIPOLI',
          description:
            'Optional. Service area for GET /merchants?cityCode=… (stored uppercase).',
        },
        latitude: {
          type: 'number',
          example: 34.4346,
          description:
            'Optional. Store WGS84 latitude; send longitude too if set.',
        },
        longitude: {
          type: 'number',
          example: 35.8362,
          description:
            'Optional. Store WGS84 longitude; send latitude too if set.',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Logo image (required)',
        },
        cover: {
          type: 'string',
          format: 'binary',
          description: 'Cover / banner image (required)',
        },
      },
    },
  })
  @Post('merchant/register')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
  )
  async registerMerchant(
    @Body() dto: RegisterMerchantDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ) {
    const logo = files.logo?.[0];
    const cover = files.cover?.[0];
    if (!logo?.buffer?.length) {
      throw new BadRequestException('logo image is required');
    }
    if (!cover?.buffer?.length) {
      throw new BadRequestException('cover image is required');
    }
    const [logoUrl, coverImageUrl] = await Promise.all([
      this.cloudinary.uploadImage(logo.buffer, 'athar/merchants/logo'),
      this.cloudinary.uploadImage(cover.buffer, 'athar/merchants/cover'),
    ]);
    return this.authService.registerMerchant(dto, logoUrl, coverImageUrl);
  }

  @ApiOperation({
    summary: 'Merchant login: send email or phone as identifier, plus password',
  })
  @Post('merchant/login')
  loginMerchant(@Body() dto: LoginMerchantDto) {
    return this.authService.loginMerchant(dto);
  }
}
