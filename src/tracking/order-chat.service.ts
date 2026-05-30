import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DocumentData } from 'firebase-admin/firestore';
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

export type OrderChatMessageDto = {
  id: string;
  senderUid: string;
  senderRole: string;
  text: string;
  createdAt: number;
};

@Injectable()
export class OrderChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  private messagesCollection(orderId: string) {
    const firestore = this.firebase.firestore;
    if (!firestore) {
      return null;
    }
    return firestore.collection('orders').doc(orderId).collection('messages');
  }

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

  private docToMessage(id: string, data: DocumentData): OrderChatMessageDto {
    return {
      id: String(data.id ?? id),
      senderUid: String(data.senderUid ?? ''),
      senderRole: String(data.senderRole ?? ''),
      text: String(data.text ?? ''),
      createdAt: Number(data.createdAt ?? 0),
    };
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
    const messagesCol = this.messagesCollection(orderId);
    if (!messagesCol) {
      return { messages: [] as OrderChatMessageDto[] };
    }

    await this.tracking.syncOrderMeta(orderId, userId, driverId);

    const snap = await messagesCol.orderBy('createdAt', 'asc').get();
    const messages = snap.docs.map((doc) =>
      this.docToMessage(doc.id, doc.data()),
    );
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

    const messagesCol = this.messagesCollection(orderId);
    if (!messagesCol) {
      throw new BadRequestException('Chat is not configured');
    }

    await this.tracking.syncOrderMeta(orderId, order.userId, order.driverId!);

    const ref = messagesCol.doc();
    const messageId = ref.id;
    const createdAt = Date.now();
    const senderRole = user.role === 'DRIVER' ? 'driver' : 'user';

    const payload = {
      id: messageId,
      senderUid,
      senderRole,
      text: trimmed,
      createdAt,
    };

    await ref.set(payload);

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

    return payload;
  }
}
