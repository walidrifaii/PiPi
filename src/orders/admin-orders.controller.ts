import {
  Body,
  Controller,
  Delete,
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
import { UpdateAdminOrderItemsDto } from './dto/update-admin-order-items.dto';
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
      'Get order detail (super admin). Includes delivery address, coordinates, items, and customer phone.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId')
  getOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.getForSuperAdmin(orderId);
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

  @ApiOperation({
    summary:
      'Edit order line quantities and optional notes (super admin). Quantity 0 removes a line. Recalculates totals and notifies customer, merchant, and assigned driver.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Patch(':orderId/items')
  updateItems(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateAdminOrderItemsDto,
  ) {
    return this.ordersService.updateItemsForSuperAdmin(orderId, dto);
  }

  @ApiOperation({
    summary:
      'Permanently delete an order (super admin). Notifies customer, merchant, and assigned driver.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Delete(':orderId')
  deleteOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.deleteForSuperAdmin(orderId);
  }
}
