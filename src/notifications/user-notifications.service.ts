import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  localizeNotification,
  withLocaleMeta,
} from '../common/i18n/localize.mapper';
import type { I18nOptions } from '../common/i18n/locale.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  orderStatusNotificationCopy,
  pickOrderStatusPushCopy,
} from './order-status-notification-copy';
import {
  type UserNotificationCategory,
  type UserNotificationChannel,
} from './user-notification.constants';

export type CreateUserNotificationParams = {
  userId: string;
  category: UserNotificationCategory;
  title: string;
  message: string;
  titleAr?: string | null;
  messageAr?: string | null;
  channel?: UserNotificationChannel;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapItem(
    row: {
      id: string;
      category: string;
      title: string;
      titleAr?: string | null;
      message: string;
      messageAr?: string | null;
      channel: string;
      isRead: boolean;
      readAt: Date | null;
      metadata: unknown;
      createdAt: Date;
    },
    i18n?: I18nOptions,
  ) {
    const base = {
      id: row.id,
      category: row.category,
      title: row.title,
      titleAr: row.titleAr ?? null,
      message: row.message,
      messageAr: row.messageAr ?? null,
      channel: row.channel,
      isRead: row.isRead,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      metadata:
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    };
    return localizeNotification(base, i18n);
  }

  async create(params: CreateUserNotificationParams) {
    const row = await this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title.trim(),
        titleAr: params.titleAr?.trim() || null,
        message: params.message.trim(),
        messageAr: params.messageAr?.trim() || null,
        channel: params.channel ?? 'INBOX',
        metadata:
          params.metadata === undefined
            ? undefined
            : (params.metadata as Prisma.InputJsonValue),
      },
    });
    return this.mapItem(row);
  }

  /** Persist an order-status row and return title/body for optional FCM. */
  async createFromOrderStatus(params: {
    userId: string;
    orderId: string;
    status: string;
    merchantName?: string;
    merchantNameAr?: string | null;
    title?: string;
    body?: string;
    titleAr?: string;
    messageAr?: string;
  }): Promise<{ title: string; body: string }> {
    const titleOverride = params.title?.trim() ?? '';
    const bodyOverride = params.body?.trim() ?? '';
    const copy =
      titleOverride.length > 0 && bodyOverride.length > 0
        ? {
            title: titleOverride,
            titleAr: params.titleAr?.trim() || titleOverride,
            body: bodyOverride,
            messageAr: params.messageAr?.trim() || bodyOverride,
          }
        : orderStatusNotificationCopy(
            params.status,
            params.merchantName,
            params.merchantNameAr,
          );

    await this.create({
      userId: params.userId,
      category: 'ORDER_STATUS',
      title: copy.title,
      titleAr: copy.titleAr,
      message: copy.body,
      messageAr: copy.messageAr,
      metadata: {
        orderId: params.orderId,
        status: String(params.status ?? '').trim().toUpperCase(),
      },
    });

    const push = pickOrderStatusPushCopy(copy, 'en');
    return { title: push.title, body: push.body };
  }

  async createWelcome(userId: string) {
    return this.create({
      userId,
      category: 'SECURITY_ALERT',
      title: 'Welcome to PipPip Delivery! 🚀',
      titleAr: 'مرحباً بك في بيب بيب للتوصيل! 🚀',
      message:
        'We are thrilled to have you with us. Enjoy fast, reliable, and premium delivery services.',
      messageAr:
        'يسعدنا انضمامك إلينا. استمتع بخدمة توصيل سريعة وموثوقة ومميزة.',
    });
  }

  async listForUser(
    userId: string,
    page: number,
    limit: number,
    channel: UserNotificationChannel,
    i18n?: I18nOptions,
  ) {
    const where = { userId, channel };
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userNotification.count({ where }),
      this.prisma.userNotification.count({
        where: { userId, channel, isRead: false },
      }),
    ]);

    return withLocaleMeta(
      {
        unreadCount,
        page,
        limit,
        total,
        items: items.map((row) => this.mapItem(row, i18n)),
      },
      i18n,
    );
  }

  async getUnreadCount(
    userId: string,
    channel: UserNotificationChannel = 'INBOX',
  ) {
    const unreadCount = await this.prisma.userNotification.count({
      where: { userId, channel, isRead: false },
    });
    return { unreadCount, channel };
  }

  async markRead(userId: string, notificationId: string, i18n?: I18nOptions) {
    const updated = await this.prisma.userNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('Notification not found');
    }
    const row = await this.prisma.userNotification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    return this.mapItem(row, i18n);
  }

  async markAllRead(userId: string, channel: UserNotificationChannel) {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, channel, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count, channel };
  }

  async clearAll(userId: string, channel: UserNotificationChannel) {
    const result = await this.prisma.userNotification.deleteMany({
      where: { userId, channel },
    });
    return { deletedCount: result.count, channel };
  }
}
