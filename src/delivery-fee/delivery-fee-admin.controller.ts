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
import { DeliveryFeeService } from './delivery-fee.service';
import { CreateDeliveryFeeConfigDto } from './dto/create-delivery-fee-config.dto';
import { UpdateDeliveryFeeConfigDto } from './dto/update-delivery-fee-config.dto';

@ApiTags('Super Admin · Delivery Fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/delivery-fees')
export class DeliveryFeeAdminController {
  constructor(private readonly deliveryFees: DeliveryFeeService) {}

  @ApiOperation({ summary: 'List all delivery fee configurations' })
  @Get()
  findAll() {
    return this.deliveryFees.findAllAdmin();
  }

  @ApiOperation({ summary: 'Get one delivery fee configuration by id' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryFees.findOneAdmin(id);
  }

  @ApiOperation({
    summary:
      'Create delivery fee: fixedFee + ceil(distanceKm / kmUnit) × feePerUnit. Saves sampleBreakdown in DB.',
  })
  @Post()
  create(@Body() dto: CreateDeliveryFeeConfigDto) {
    return this.deliveryFees.createAdmin(dto);
  }

  @ApiOperation({ summary: 'Update delivery fee configuration' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryFeeConfigDto,
  ) {
    return this.deliveryFees.updateAdmin(id, dto);
  }

  @ApiOperation({ summary: 'Delete delivery fee configuration' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryFees.deleteAdmin(id);
  }
}
