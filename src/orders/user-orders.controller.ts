import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Body,
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
import { TrackingService } from '../tracking/tracking.service';
import { OrderChatService } from '../tracking/order-chat.service';
import { OrderCallService } from '../tracking/order-call.service';
import { SendOrderMessageDto } from '../tracking/dto/send-order-message.dto';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('orders/me')
export class UserOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly tracking: TrackingService,
    private readonly orderChat: OrderChatService,
    private readonly orderCall: OrderCallService,
  ) {}

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

  @ApiOperation({
    summary:
      'Last known driver GPS for live map (HTTP fallback when Firebase listener is blocked)',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/tracking/location')
  getTrackingLocation(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.tracking.getCustomerTrackingLocation(req.user!.sub, orderId);
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

  @ApiOperation({
    summary: 'Phone number for the assigned driver (active delivery only)',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/contact')
  getContact(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderChat.getContactForUser(req.user!.sub, orderId);
  }

  @ApiOperation({ summary: 'List chat messages for an order (HTTP fallback)' })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/messages')
  listMessages(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderChat.listMessagesForUser(req.user!.sub, orderId);
  }

  @ApiOperation({ summary: 'Start in-app voice call (Agora token + channel)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/call')
  startCall(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderCall.startCallForUser(req.user!.sub, orderId);
  }

  @ApiOperation({ summary: 'Send a chat message to the driver' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/messages')
  sendMessage(
    @Req() req: { user?: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.orderChat.sendMessage(req.user!, orderId, dto.text);
  }
}
