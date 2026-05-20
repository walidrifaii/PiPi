import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { UserAccountGuard } from '../auth/user-account.guard';
import { OrdersService } from './orders.service';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('orders/me')
export class UserOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'List your orders (customer JWT)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get()
  list(
    @Req() req: { user?: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ordersService.listForUser(req.user!.sub, page, limit);
  }

  @ApiOperation({ summary: 'Get one of your orders by id (customer JWT)' })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId')
  getOne(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getForUser(req.user!.sub, orderId);
  }
}
