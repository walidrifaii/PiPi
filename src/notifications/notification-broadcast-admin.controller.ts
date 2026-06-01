import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CreateNotificationBroadcastDto } from './dto/create-notification-broadcast.dto';
import {
  BROADCAST_BATCH_SIZE,
  NotificationBroadcastService,
} from './notification-broadcast.service';

@ApiTags('Super Admin · Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/notifications/broadcasts')
export class NotificationBroadcastAdminController {
  constructor(private readonly broadcasts: NotificationBroadcastService) {}

  @ApiOperation({ summary: 'List recent notification broadcasts' })
  @Get()
  list() {
    return this.broadcasts.listAdmin();
  }

  @ApiOperation({ summary: 'Get broadcast status and progress' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.broadcasts.getAdmin(id);
  }

  @ApiOperation({
    summary: `Create broadcast and send to first ${BROADCAST_BATCH_SIZE} users (inbox + FCM)`,
  })
  @Post()
  create(@Body() dto: CreateNotificationBroadcastDto) {
    return this.broadcasts.createAndSendFirstBatch(dto);
  }

  @ApiOperation({
    summary: `Send next batch (${BROADCAST_BATCH_SIZE} users). Repeat until broadcast.hasMore is false.`,
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/send-next')
  sendNext(@Param('id', ParseUUIDPipe) id: string) {
    return this.broadcasts.sendNextBatch(id);
  }
}
