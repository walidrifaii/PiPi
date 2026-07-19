import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
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
import { AssignOrderDriverDto } from './dto/assign-order-driver.dto';
import { ListAdminOrderQueueQueryDto } from './dto/list-admin-order-queue-query.dto';
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { DriverOrdersService } from './driver-orders.service';
import { OrdersService } from './orders.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly driverOrdersService: DriverOrdersService,
  ) {}

  @ApiOperation({
    summary:
      'List order queue (PENDING + DELIVERING). Hides pending orders whose assigned driver is busy on another delivery.',
  })
  @Get('queue')
  listQueue(@Query() query: ListAdminOrderQueueQueryDto) {
    return this.ordersService.listQueueForSuperAdmin(query);
  }

  @ApiOperation({
    summary:
      'Driver ids currently on an active delivery (DELIVERING / DISPATCHED).',
  })
  @Get('busy-driver-ids')
  listBusyDriverIds() {
    return this.ordersService.getBusyDriverIdsForAdmin();
  }

  @ApiOperation({
    summary:
      'List all orders (super admin). Includes customer.phone, merchant.phone, and driver.phone when a driver is assigned. Optional filters: merchantId, orderId, userName, number (phone), status (`LIVE` or a specific status), from / to (ISO date range).',
  })
  @Get()
  list(@Query() query: ListOrdersAdminQueryDto) {
    return this.ordersService.listForSuperAdmin(query);
  }

  @ApiOperation({
    summary:
      'Assign an unassigned PENDING or ACCEPTED order to a driver. ACCEPTED orders start delivery immediately.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Patch(':orderId/assign-driver')
  assignDriver(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignOrderDriverDto,
  ) {
    return this.driverOrdersService.assignOrderByAdmin(orderId, dto.driverId);
  }

  @ApiOperation({
    summary:
      'Update any order status (super admin). Sends a push notification to the customer.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Patch(':orderId/status')
  updateStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatusForSuperAdmin(orderId, dto);
  }
}
