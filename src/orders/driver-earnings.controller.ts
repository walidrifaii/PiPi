import { Controller, DefaultValuePipe, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DriverAccountGuard } from '../auth/driver-account.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { DriverOrdersService } from './driver-orders.service';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DriverAccountGuard)
@Controller('drivers/me/earnings')
export class DriverEarningsController {
  constructor(private readonly driverOrders: DriverOrdersService) {}

  @ApiOperation({
    summary:
      'Driver earnings from completed deliveries (delivery fees) for day, week, or month',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['day', 'week', 'month'],
    example: 'week',
  })
  @Get()
  getEarnings(
    @Req() req: { user: JwtUserPayload },
    @Query('period', new DefaultValuePipe('week')) period: string,
  ) {
    return this.driverOrders.getEarnings(req.user.sub, period);
  }
}
