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
import { ListAdminAllMerchantEarningsQueryDto } from './dto/list-admin-all-merchant-earnings-query.dto';
import { MerchantEarningsQueryDto } from './dto/merchant-earnings-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/merchants')
export class AdminMerchantEarningsController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'List merchant payout totals (all stores)',
    description:
      'Simple paginated table: gross food, platform fee, merchant earnings, paid and unpaid amounts per store. No orders or line items.',
  })
  @Get('earnings')
  listAllMerchantEarnings(@Query() query: ListAdminAllMerchantEarningsQueryDto) {
    return this.ordersService.listAllMerchantEarningsForAdmin(query);
  }

  @ApiOperation({
    summary:
      'Merchant earnings breakdown (paid to merchant vs platform share on food sales)',
  })
  @ApiParam({ name: 'merchantId', type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Get(':merchantId/earnings')
  getMerchantEarnings(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query() query: MerchantEarningsQueryDto,
  ) {
    return this.ordersService.getMerchantEarningsForAdmin(merchantId, query);
  }

  @ApiOperation({
    summary:
      'Mark all unpaid merchant earnings in the period as PAID (saved in history, zeroes merchant balance)',
  })
  @ApiParam({ name: 'merchantId', type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @Post(':merchantId/earnings/mark-paid')
  markMerchantPaid(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query() query: MerchantEarningsQueryDto,
  ) {
    return this.ordersService.markMerchantEarningsPaid(merchantId, query);
  }
}
