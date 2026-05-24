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
      'List all orders (super admin). Optional filters: merchantId, orderId, userName, number (phone).',
  })
  @Get()
  list(@Query() query: ListOrdersAdminQueryDto) {
    return this.ordersService.listForSuperAdmin(query);
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
