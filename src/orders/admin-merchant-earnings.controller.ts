import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { MerchantEarningsQueryDto } from './dto/merchant-earnings-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/merchants')
export class AdminMerchantEarningsController {
  constructor(private readonly ordersService: OrdersService) {}

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
}
