import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { orderStatusNotificationCopy } from './order-status-notification-copy';
import {
  type UserNotificationCategory,
  type UserNotificationChannel,
} from './user-notification.constants';

export type CreateUserNotificationParams = {
  userId: string;
  category: UserNotificationCategory;
  title: string;
  message: string;
  channel?: UserNotificationChannel;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapItem(row: {
    id: string;
    category: string;
    title: string;
    message: string;
    channel: string;
    isRead: boolean;
    readAt: Date | null;
    metadata: unknown;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      message: row.message,
      channel: row.channel,
      isRead: row.isRead,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    };
  }

  async create(params: CreateUserNotificationParams) {
    const row = await this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title.trim(),
        message: params.message.trim(),
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
    title?: string;
    body?: string;
  }): Promise<{ title: string; body: string }> {
    const titleOverride = params.title?.trim() ?? '';
    const bodyOverride = params.body?.trim() ?? '';
    const copy =
      titleOverride.length > 0 && bodyOverride.length > 0
        ? { title: titleOverride, body: bodyOverride }
        : orderStatusNotificationCopy(params.status, params.merchantName);

    await this.create({
      userId: params.userId,
      category: 'ORDER_STATUS',
      title: copy.title,
      message: copy.body,
      metadata: {
        orderId: params.orderId,
        status: String(params.status ?? '').trim().toUpperCase(),
      },
    });

    return { title: copy.title, body: copy.body };
  }

  async createWelcome(userId: string) {
    return this.create({
      userId,
      category: 'SECURITY_ALERT',
      title: 'Welcome to PipPip Delivery! 🚀',
      message:
        'We are thrilled to have you with us. Enjoy fast, reliable, and premium delivery services.',
    });
  }

  async listForUser(
    userId: string,
    page: number,
    limit: number,
    channel: UserNotificationChannel,
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

    return {
      unreadCount,
      page,
      limit,
      total,
      items: items.map((row) => this.mapItem(row)),
    };
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

  async markRead(userId: string, notificationId: string) {
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
    return this.mapItem(row);
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
