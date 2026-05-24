import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Shared')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary:
      'Send a test FCM push to a device token (for development). Requires Firebase service account in server .env.',
  })
  @Post('test')
  sendTest(@Body() dto: SendTestNotificationDto) {
    return this.notificationsService.sendTestNotification(dto);
  }
}
