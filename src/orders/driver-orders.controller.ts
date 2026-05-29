import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
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
import { DriverAccountGuard } from '../auth/driver-account.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { DriverOrdersService } from './driver-orders.service';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DriverAccountGuard)
@Controller('drivers/me/orders')
export class DriverOrdersController {
  constructor(private readonly driverOrders: DriverOrdersService) {}

  @ApiOperation({
    summary: 'List unassigned delivery offers (ACCEPTED after merchant accept, no driver)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('available')
  listAvailable(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverOrders.listAvailable(req.user.sub, page, limit);
  }

  @ApiOperation({
    summary: 'Your current active delivery (DELIVERING), if any',
  })
  @Get('active')
  getActive(@Req() req: { user: JwtUserPayload }) {
    return this.driverOrders.getActiveAssignment(req.user.sub);
  }

  @ApiOperation({ summary: 'List orders assigned to you' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get()
  listMine(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverOrders.listMine(req.user.sub, page, limit);
  }

  @ApiOperation({ summary: 'Accept an available offer (assigns driver_id)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/accept')
  accept(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.driverOrders.acceptOrder(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Confirm pickup at merchant (DISPATCHED)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/pickup')
  confirmPickup(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.driverOrders.confirmPickup(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Mark your active delivery as finished (DELIVERED)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/complete')
  complete(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.driverOrders.completeOrder(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Get one of your assigned orders' })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId')
  getOne(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.driverOrders.getOne(req.user.sub, orderId);
  }
}
