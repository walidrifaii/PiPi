import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('Admin – Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/coupons')
export class CouponAdminController {
  constructor(private readonly coupons: CouponService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a coupon code',
    description:
      'Creates a percentage-off coupon. Supply any authorName you want (e.g. "Marketing Team", "Ahmed").',
  })
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all coupons with usage stats',
  })
  findAll() {
    return this.coupons.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a coupon with full usage details (which users redeemed it)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update coupon (discountPercent, expiresAt, maxUsages, isActive)',
    description: 'The code itself cannot be changed after creation.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Permanently delete a coupon',
    description:
      'Hard-delete. Use PATCH isActive=false to soft-disable without losing history.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.remove(id);
  }
}
