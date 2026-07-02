import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { CreateNotificationBroadcastDto } from './dto/create-notification-broadcast.dto';
import {
  isUserNotificationCategory,
  type UserNotificationCategory,
} from './user-notification.constants';

export const BROADCAST_BATCH_SIZE = 10;

const eligibleUserWhere = {
  isActive: true,
  deletionRequestedAt: null,
} satisfies Prisma.UserWhereInput;

@Injectable()
export class NotificationBroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private mapBroadcast(row: {
    id: string;
    title: string;
    titleAr?: string | null;
    message: string;
    messageAr?: string | null;
    category: string;
    status: string;
    lastUserId: string | null;
    totalUsers: number;
    usersProcessed: number;
    inboxCreated: number;
    pushSuccessCount: number;
    pushFailureCount: number;
    sendPush: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const hasMore =
      row.status === 'IN_PROGRESS' && row.usersProcessed < row.totalUsers;
    return {
      id: row.id,
      title: row.title,
      titleAr: row.titleAr ?? null,
      message: row.message,
      messageAr: row.messageAr ?? null,
      category: row.category,
      status: row.status,
      lastUserId: row.lastUserId,
      totalUsers: row.totalUsers,
      usersProcessed: row.usersProcessed,
      inboxCreated: row.inboxCreated,
      pushSuccessCount: row.pushSuccessCount,
      pushFailureCount: row.pushFailureCount,
      sendPush: row.sendPush,
      batchSize: BROADCAST_BATCH_SIZE,
      hasMore,
      progressPercent:
        row.totalUsers > 0
          ? Math.min(
              100,
              Math.round((row.usersProcessed / row.totalUsers) * 100),
            )
          : 100,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listAdmin() {
    const rows = await this.prisma.notificationBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.mapBroadcast(row));
  }

  async getAdmin(id: string) {
    const row = await this.prisma.notificationBroadcast.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Broadcast not found');
    }
    return this.mapBroadcast(row);
  }

  /** Create campaign and deliver to the first batch (10 users). */
  async createAndSendFirstBatch(dto: CreateNotificationBroadcastDto) {
    const category: UserNotificationCategory =
      dto.category && isUserNotificationCategory(dto.category)
        ? dto.category
        : 'SPECIAL_OFFER';

    const totalUsers = await this.prisma.user.count({
      where: eligibleUserWhere,
    });

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        title: dto.title.trim(),
        titleAr: dto.titleAr?.trim() || null,
        message: dto.message.trim(),
        messageAr: dto.messageAr?.trim() || null,
        category,
        sendPush: dto.sendPush ?? true,
        totalUsers,
        status: totalUsers === 0 ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });

    if (totalUsers === 0) {
      return {
        broadcast: this.mapBroadcast(broadcast),
        batch: {
          usersInBatch: 0,
          inboxCreated: 0,
          pushSuccessCount: 0,
          pushFailureCount: 0,
        },
      };
    }

    const batch = await this.processNextBatch(broadcast.id);
    const updated = await this.prisma.notificationBroadcast.findUniqueOrThrow({
      where: { id: broadcast.id },
    });
    return { broadcast: this.mapBroadcast(updated), batch };
  }

  /** Send inbox + optional FCM to the next 10 users. Call until hasMore is false. */
  async sendNextBatch(broadcastId: string) {
    const broadcast = await this.prisma.notificationBroadcast.findUnique({
      where: { id: broadcastId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }
    if (broadcast.status === 'COMPLETED') {
      return {
        broadcast: this.mapBroadcast(broadcast),
        batch: {
          usersInBatch: 0,
          inboxCreated: 0,
          pushSuccessCount: 0,
          pushFailureCount: 0,
          message: 'Broadcast already completed',
        },
      };
    }

    const batch = await this.processNextBatch(broadcastId);
    const updated = await this.prisma.notificationBroadcast.findUniqueOrThrow({
      where: { id: broadcastId },
    });
    return { broadcast: this.mapBroadcast(updated), batch };
  }

  private async processNextBatch(broadcastId: string) {
    const broadcast = await this.prisma.notificationBroadcast.findUnique({
      where: { id: broadcastId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }
    if (broadcast.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Broadcast is not in progress');
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...eligibleUserWhere,
        ...(broadcast.lastUserId
          ? { id: { gt: broadcast.lastUserId } }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: BROADCAST_BATCH_SIZE,
      select: { id: true, fcmToken: true },
    });

    if (users.length === 0) {
      await this.prisma.notificationBroadcast.update({
        where: { id: broadcastId },
        data: { status: 'COMPLETED' },
      });
      return {
        usersInBatch: 0,
        inboxCreated: 0,
        pushSuccessCount: 0,
        pushFailureCount: 0,
        message: 'No more users — broadcast completed',
      };
    }

    const metadata = {
      broadcastId: broadcast.id,
    } satisfies Prisma.InputJsonObject;

    const inboxRows = await Promise.all(
      users.map((user) =>
        this.prisma.userNotification.create({
          data: {
            userId: user.id,
            category: broadcast.category,
            title: broadcast.title,
            titleAr: broadcast.titleAr,
            message: broadcast.message,
            messageAr: broadcast.messageAr,
            channel: 'INBOX',
            metadata,
          },
          select: { id: true, userId: true },
        }),
      ),
    );

    const usersWithToken = users.filter((u) => u.fcmToken?.trim());
    const usersWithoutToken = users.length - usersWithToken.length;

    let pushSuccessCount = 0;
    let pushFailureCount = 0;
    let pushReason: string | undefined;

    if (broadcast.sendPush) {
      const tokenByUserId = new Map(
        users
          .filter((u) => u.fcmToken?.trim())
          .map((u) => [u.id, u.fcmToken!.trim()] as const),
      );
      const recipients = inboxRows
        .map((row) => {
          const token = tokenByUserId.get(row.userId);
          if (!token) {
            return null;
          }
          return { token, notificationId: row.id };
        })
        .filter((r): r is { token: string; notificationId: string } => r !== null);

      if (recipients.length > 0) {
        const push = await this.notifications.sendBroadcastPush({
          recipients,
          title: broadcast.title,
          body: broadcast.message,
          broadcastId: broadcast.id,
          category: broadcast.category,
        });
        pushSuccessCount = push.successCount;
        pushFailureCount = push.failureCount;
        pushReason = push.reason;
      } else {
        pushReason = 'no_tokens_in_batch';
      }
    }

    const inboxCreated = inboxRows.length;

    const lastUserId = users[users.length - 1]!.id;
    const usersProcessed = broadcast.usersProcessed + users.length;
    const completed =
      users.length < BROADCAST_BATCH_SIZE ||
      usersProcessed >= broadcast.totalUsers;

    await this.prisma.notificationBroadcast.update({
      where: { id: broadcastId },
      data: {
        lastUserId,
        usersProcessed,
        inboxCreated: broadcast.inboxCreated + inboxCreated,
        pushSuccessCount: broadcast.pushSuccessCount + pushSuccessCount,
        pushFailureCount: broadcast.pushFailureCount + pushFailureCount,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });

    return {
      usersInBatch: users.length,
      inboxCreated,
      usersWithFcmToken: usersWithToken.length,
      usersWithoutToken,
      pushSuccessCount,
      pushFailureCount,
      pushReason,
      lastUserId,
    };
  }
}
