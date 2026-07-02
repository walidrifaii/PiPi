import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { I18n } from '../common/i18n/locale.decorator';
import type { I18nOptions } from '../common/i18n/locale.types';
import { ListUserNotificationsQueryDto } from './dto/list-user-notifications-query.dto';
import { UserNotificationsService } from './user-notifications.service';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('notifications/me')
export class UserNotificationsController {
  constructor(
    private readonly userNotifications: UserNotificationsService,
  ) {}

  @ApiOperation({
    summary:
      'List your in-app notifications (inbox). Supports INBOX and DEVELOPER_LAB channels.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['ar', 'en'],
    description:
      'Response language for title/message. Omit for bilingual (title + titleAr, message + messageAr).',
  })
  @Get()
  list(
    @Req() req: { user?: JwtUserPayload },
    @Query() query: ListUserNotificationsQueryDto,
    @I18n() i18n?: I18nOptions,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const channel = query.channel ?? 'INBOX';
    return this.userNotifications.listForUser(
      req.user!.sub,
      page,
      limit,
      channel,
      i18n,
    );
  }

  @ApiOperation({ summary: 'Unread notification count for a channel' })
  @Get('unread-count')
  unreadCount(
    @Req() req: { user?: JwtUserPayload },
    @Query() query: Pick<ListUserNotificationsQueryDto, 'channel'>,
  ) {
    return this.userNotifications.getUnreadCount(
      req.user!.sub,
      query.channel ?? 'INBOX',
    );
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'lang', required: false, enum: ['ar', 'en'] })
  @Patch(':id/read')
  markRead(
    @Req() req: { user?: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.userNotifications.markRead(req.user!.sub, id, i18n);
  }

  @ApiOperation({ summary: 'Mark all notifications in a channel as read' })
  @Patch('read-all')
  markAllRead(
    @Req() req: { user?: JwtUserPayload },
    @Query() query: Pick<ListUserNotificationsQueryDto, 'channel'>,
  ) {
    return this.userNotifications.markAllRead(
      req.user!.sub,
      query.channel ?? 'INBOX',
    );
  }

  @ApiOperation({ summary: 'Delete all notifications in a channel (clear all)' })
  @Delete()
  clearAll(
    @Req() req: { user?: JwtUserPayload },
    @Query() query: Pick<ListUserNotificationsQueryDto, 'channel'>,
  ) {
    return this.userNotifications.clearAll(
      req.user!.sub,
      query.channel ?? 'INBOX',
    );
  }
}
