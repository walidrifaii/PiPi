import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { isOrderContactableStatus } from '../orders/order-status.constants';
import { TrackingService } from './tracking.service';

export type OrderContactDto = {
  orderId: string;
  name: string;
  phone: string;
  role: 'customer' | 'driver';
};

@Injectable()
export class OrderChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  private async loadOrderForContact(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
        user: { select: { id: true, fullName: true, phone: true, fcmToken: true } },
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            vehicleType: true,
            fcmToken: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!order.driverId || !order.driver) {
      throw new BadRequestException('No driver assigned to this order yet');
    }
    if (!isOrderContactableStatus(order.status)) {
      throw new BadRequestException(
        'Chat and call are only available during active delivery',
      );
    }
    return order;
  }

  async getContactForUser(userId: string, orderId: string): Promise<OrderContactDto> {
    const order = await this.loadOrderForContact(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    await this.tracking
      .syncOrderMeta(orderId, order.userId, order.driverId!)
      .catch(() => undefined);

    const driver = order.driver!;
    return {
      orderId,
      name: driver.fullName?.trim() || 'Driver',
      phone: driver.phone,
      role: 'driver',
    };
  }

  async getContactForDriver(
    driverId: string,
    orderId: string,
  ): Promise<OrderContactDto> {
    const order = await this.loadOrderForContact(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }
    await this.tracking
      .syncOrderMeta(orderId, order.userId, order.driverId!)
      .catch(() => undefined);

    return {
      orderId,
      name: order.user.fullName?.trim() || 'Customer',
      phone: order.user.phone,
      role: 'customer',
    };
  }

  private parseMessagesFromRtdb(
    raw: unknown,
  ): Array<{
    id: string;
    senderUid: string;
    senderRole: string;
    text: string;
    createdAt: number;
  }> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return [];
    }
    const messages: Array<{
      id: string;
      senderUid: string;
      senderRole: string;
      text: string;
      createdAt: number;
    }> = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const row = value as Record<string, unknown>;
      messages.push({
        id: String(row.id ?? key),
        senderUid: String(row.senderUid ?? ''),
        senderRole: String(row.senderRole ?? ''),
        text: String(row.text ?? ''),
        createdAt: Number(row.createdAt ?? 0),
      });
    }
    messages.sort((a, b) => a.createdAt - b.createdAt);
    return messages;
  }

  async listMessagesForUser(userId: string, orderId: string) {
    const order = await this.loadOrderForContact(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    return this.listMessages(orderId, order.userId, order.driverId!);
  }

  async listMessagesForDriver(driverId: string, orderId: string) {
    const order = await this.loadOrderForContact(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }
    return this.listMessages(orderId, order.userId, order.driverId!);
  }

  private async listMessages(
    orderId: string,
    userId: string,
    driverId: string,
  ) {
    const db = this.firebase.database;
    if (!db) {
      return { messages: [] as ReturnType<OrderChatService['parseMessagesFromRtdb']> };
    }

    await this.tracking.syncOrderMeta(orderId, userId, driverId);

    const snap = await db.ref(`orders/${orderId}/messages`).get();
    const messages = this.parseMessagesFromRtdb(snap.val());
    return { messages };
  }

  async sendMessage(
    user: JwtUserPayload,
    orderId: string,
    text: string,
  ) {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty');
    }

    const order = await this.loadOrderForContact(orderId);
    const senderUid = this.tracking.firebaseUidForJwt(user);

    if (user.role === 'USER') {
      if (order.userId !== user.sub) {
        throw new ForbiddenException('Not your order');
      }
    } else if (user.role === 'DRIVER') {
      if (order.driverId !== user.sub) {
        throw new ForbiddenException('Not your delivery');
      }
    } else {
      throw new ForbiddenException('Only customer or driver can send messages');
    }

    const db = this.firebase.database;
    if (!db) {
      throw new BadRequestException('Chat is not configured');
    }

    await this.tracking.syncOrderMeta(orderId, order.userId, order.driverId!);

    const ref = db.ref(`orders/${orderId}/messages`).push();
    const messageId = ref.key ?? `${Date.now()}`;
    const createdAt = Date.now();
    const senderRole = user.role === 'DRIVER' ? 'driver' : 'user';

    await ref.set({
      id: messageId,
      senderUid,
      senderRole,
      text: trimmed,
      createdAt,
    });

    const preview =
      trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
    const senderName =
      user.role === 'DRIVER'
        ? order.driver!.fullName?.trim() || 'Driver'
        : order.user.fullName?.trim() || 'Customer';

    if (user.role === 'USER') {
      const driver = order.driver!;
      const token = driver.fcmToken?.trim();
      if (token) {
        await this.notifications.sendOrderChatMessage({
          fcmToken: token,
          orderId,
          title: 'New message',
          body: `${senderName}: ${preview}`,
          recipientRole: 'driver',
        });
      }
    } else {
      const token = order.user.fcmToken?.trim();
      if (token) {
        await this.notifications.sendOrderChatMessage({
          fcmToken: token,
          orderId,
          title: 'Message from driver',
          body: `${senderName}: ${preview}`,
          recipientRole: 'user',
        });
      }
    }

    return {
      id: messageId,
      senderUid,
      senderRole,
      text: trimmed,
      createdAt,
    };
  }
}
