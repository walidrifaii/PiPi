import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AdminDriverEarningsQueryDto } from './dto/admin-participant-earnings-query.dto';
import { DriverOrdersService } from './driver-orders.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/drivers')
export class AdminDriverEarningsController {
  constructor(private readonly driverOrders: DriverOrdersService) {}

  @ApiOperation({
    summary:
      'Driver earnings breakdown (paid to driver vs platform share on delivery fees)',
  })
  @ApiParam({ name: 'driverId', type: String })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'all'] })
  @Get(':driverId/earnings')
  getDriverEarnings(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query() query: AdminDriverEarningsQueryDto,
  ) {
    return this.driverOrders.getEarningsForAdmin(driverId, query.period ?? 'month');
  }

  @ApiOperation({
    summary:
      'Mark all unpaid driver earnings in the period as PAID (saved in history, zeroes driver balance)',
  })
  @ApiParam({ name: 'driverId', type: String })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'all'] })
  @Post(':driverId/earnings/mark-paid')
  markDriverPaid(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query() query: AdminDriverEarningsQueryDto,
  ) {
    return this.driverOrders.markDriverEarningsPaid(
      driverId,
      query.period ?? 'month',
    );
  }
}
