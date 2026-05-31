import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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
}
