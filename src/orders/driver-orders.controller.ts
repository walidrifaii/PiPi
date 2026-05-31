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
import { DriverAccountGuard } from '../auth/driver-account.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { DriverOrdersService } from './driver-orders.service';
import { OrderChatService } from '../tracking/order-chat.service';
import { OrderCallService } from '../tracking/order-call.service';
import { SendOrderMessageDto } from '../tracking/dto/send-order-message.dto';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DriverAccountGuard)
@Controller('drivers/me/orders')
export class DriverOrdersController {
  constructor(
    private readonly driverOrders: DriverOrdersService,
    private readonly orderChat: OrderChatService,
    private readonly orderCall: OrderCallService,
  ) {}

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

  @ApiOperation({
    summary: 'Sync Firestore order meta so chat security rules allow reads/writes',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/chat-ready')
  chatReady(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderChat.prepareChatForDriver(req.user.sub, orderId);
  }

  @ApiOperation({
    summary: 'Customer phone for call (active delivery only)',
  })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/contact')
  getContact(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderChat.getContactForDriver(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'List chat messages for an order (HTTP fallback)' })
  @ApiParam({ name: 'orderId', type: String })
  @Get(':orderId/messages')
  listMessages(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderChat.listMessagesForDriver(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Start in-app voice call (Agora token + channel)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/call')
  startCall(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderCall.startCallForDriver(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Accept incoming order voice call' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/call/accept')
  acceptCall(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderCall.acceptCallForDriver(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Decline or cancel order voice call' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/call/decline')
  declineCall(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderCall.declineCallForDriver(req.user.sub, orderId);
  }

  @ApiOperation({ summary: 'Push notify for a Firestore chat message' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/messages/notify')
  notifyMessage(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.orderChat.notifyMessage(req.user, orderId, dto.text);
  }

  @ApiOperation({ summary: 'Send a chat message to the customer (server write fallback)' })
  @ApiParam({ name: 'orderId', type: String })
  @Post(':orderId/messages')
  sendMessage(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.orderChat.sendMessage(
      req.user,
      orderId,
      dto.text,
      dto.messageId,
    );
  }
}
