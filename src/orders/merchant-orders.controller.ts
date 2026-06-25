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
import { ListMerchantOrdersHistoryQueryDto } from './dto/list-merchant-orders-history-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
@Controller('merchants/me/orders')
export class MerchantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'List orders for your store (merchant JWT)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get()
  list(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.listForMerchant(merchantId, page, limit);
  }

  @ApiOperation({
    summary:
      'List order history for your store — DELIVERED and CANCELLED only (merchant JWT). Optional `status` (`Delivered` | `Cancelled`), `search` (order id or customer name), `from` / `to` (ISO date range).',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['Delivered', 'Cancelled'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('history')
  listHistory(
    @EffectiveMerchantId() merchantId: string,
    @Query() query: ListMerchantOrdersHistoryQueryDto,
  ) {
    return this.ordersService.listHistoryForMerchant(merchantId, query);
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
