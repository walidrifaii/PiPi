import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary:
      'List all orders (super admin). Optional filters: merchantId, orderId, userName, number (phone), status (`LIVE` or a specific status), statusIn (comma-separated), unassignedOnly, from / to (ISO date range).',
  })
  @Get()
  list(@Query() query: ListOrdersAdminQueryDto) {
    return this.ordersService.listForSuperAdmin(query);
  }

  @ApiOperation({
    summary:
      'Assign any active driver to an unassigned PENDING or ACCEPTED order (super admin).',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/assign-driver')
  assignDriver(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignOrderDriverDto,
  ) {
    return this.ordersService.assignDriverForSuperAdmin(orderId, dto.driverId);
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
