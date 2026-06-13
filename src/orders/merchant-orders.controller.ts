import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { normalizeOrderStatus } from './order-status.constants';
import { OrdersService } from './orders.service';

@ApiTags('Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
@Controller('merchants/me/orders')
export class MerchantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'List orders for your store (merchant JWT)',
    description:
      'Returns DELIVERED and CANCELLED orders by default. Pass `status` as a comma-separated list to override (e.g. live orders: PENDING,ACCEPTED,PREPARING,READY,DISPATCHED,DELIVERING).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    example: 'DELIVERED,CANCELLED',
  })
  @Get()
  list(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const statuses = status
      ?.split(',')
      .map((value) => normalizeOrderStatus(value.trim()))
      .filter(Boolean);
    return this.ordersService.listForMerchant(
      merchantId,
      page,
      limit,
      statuses?.length ? statuses : undefined,
    );
  }

  @ApiOperation({ summary: 'Get one store order by id (merchant JWT)' })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId')
  getOne(
    @EffectiveMerchantId() merchantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getForMerchant(merchantId, orderId);
  }

  @ApiOperation({
    summary:
      'Update order status (e.g. ACCEPTED). Sends a push notification to the customer.',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Patch(':orderId/status')
  updateStatus(
    @EffectiveMerchantId() merchantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatusForMerchant(merchantId, orderId, dto);
  }
}
