import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { MerchantEarningsQueryDto } from './dto/merchant-earnings-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
@Controller('merchants/me/earnings')
export class MerchantEarningsController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary:
      'Merchant earnings summary for a date range (delivered orders, food share applied)',
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get()
  getEarnings(
    @EffectiveMerchantId() merchantId: string,
    @Query() query: MerchantEarningsQueryDto,
  ) {
    return this.ordersService.getMerchantEarnings(merchantId, query);
  }

  @ApiOperation({
    summary:
      'List paid (settled) orders for your store — delivered orders with payout status PAID',
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'last15Days', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('paid-orders')
  listPaidOrders(
    @EffectiveMerchantId() merchantId: string,
    @Query() query: MerchantEarningsQueryDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.listPaidOrdersForMerchant(
      merchantId,
      query,
      page,
      limit,
    );
  }

  @ApiOperation({
    summary:
      'List paid earnings settlements for your store (each payout batch marked paid by admin)',
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'last15Days', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('settlements')
  listSettlements(
    @EffectiveMerchantId() merchantId: string,
    @Query() query: MerchantEarningsQueryDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.listMerchantSettlements(
      merchantId,
      query,
      page,
      limit,
    );
  }

  @ApiOperation({
    summary:
      'Get one earnings settlement and its paid orders (tap a settlement from the list)',
  })
  @ApiParam({ name: 'settlementId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('settlements/:settlementId')
  getSettlementOrders(
    @EffectiveMerchantId() merchantId: string,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.getMerchantSettlementOrders(
      merchantId,
      settlementId,
      page,
      limit,
    );
  }
}
