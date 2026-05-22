import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
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
}
