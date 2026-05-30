import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { isOrderContactableStatus } from '../orders/order-status.constants';
import { TrackingService } from './tracking.service';

export type OrderCallSessionDto = {
  orderId: string;
  appId: string;
  channel: string;
  token: string;
  uid: number;
  peerName: string;
};

@Injectable()
export class OrderCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  private channelForOrder(orderId: string): string {
    const compact = orderId.replace(/-/g, '');
    return `pip_order_${compact}`.slice(0, 64);
  }

  private uidForRole(role: 'USER' | 'DRIVER'): number {
    return role === 'DRIVER' ? 2 : 1;
  }

  private buildAgoraToken(channel: string, uid: number): string {
    const appId = process.env.AGORA_APP_ID?.trim();
    const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim();
    if (!appId || !appCertificate) {
      throw new ServiceUnavailableException(
        'In-app voice calls are not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the server.',
      );
    }

    const expire = Math.floor(Date.now() / 1000) + 3600;
    return RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      expire,
      expire,
    );
  }

  private async assertOrderCall(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
        user: { select: { id: true, fullName: true, fcmToken: true } },
        driver: {
          select: { id: true, fullName: true, fcmToken: true },
        },
      },
    });
    if (!order) {
      throw new ForbiddenException('Order not found');
    }
    if (!order.driverId || !order.driver) {
      throw new BadRequestException('No driver assigned to this order yet');
    }
    if (!isOrderContactableStatus(order.status)) {
      throw new BadRequestException(
        'Calls are only available during active delivery',
      );
    }
    return order;
  }

  async startCallForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderCallSessionDto> {
    const order = await this.assertOrderCall(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }

    await this.tracking
      .syncOrderMeta(orderId, order.userId, order.driverId!)
      .catch(() => undefined);

    const channel = this.channelForOrder(orderId);
    const uid = this.uidForRole('USER');
    const token = this.buildAgoraToken(channel, uid);

    const driver = order.driver!;
    await this.signalCall(orderId, 'user');
    await this.notifyIncomingCall(
      orderId,
      { user: order.user, driver },
      'customer',
    );

    return {
      orderId,
      appId: process.env.AGORA_APP_ID!.trim(),
      channel,
      token,
      uid,
      peerName: driver.fullName?.trim() || 'Driver',
    };
  }

  async startCallForDriver(
    driverId: string,
    orderId: string,
  ): Promise<OrderCallSessionDto> {
    const order = await this.assertOrderCall(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }

    await this.tracking
      .syncOrderMeta(orderId, order.userId, order.driverId!)
      .catch(() => undefined);

    const channel = this.channelForOrder(orderId);
    const uid = this.uidForRole('DRIVER');
    const token = this.buildAgoraToken(channel, uid);

    const driver = order.driver!;
    await this.signalCall(orderId, 'driver');
    await this.notifyIncomingCall(
      orderId,
      { user: order.user, driver },
      'driver',
    );

    return {
      orderId,
      appId: process.env.AGORA_APP_ID!.trim(),
      channel,
      token,
      uid,
      peerName: order.user.fullName?.trim() || 'Customer',
    };
  }

  /** Firestore call invite (live listener + FCM). */
  private async signalCall(orderId: string, startedBy: 'user' | 'driver') {
    const firestore = this.firebase.firestore;
    if (!firestore) {
      return;
    }
    await firestore.collection('orders').doc(orderId).set(
      {
        call: {
          active: true,
          startedBy,
          startedAt: Date.now(),
        },
      },
      { merge: true },
    );
  }

  private async notifyIncomingCall(
    orderId: string,
    order: {
      user: { fullName: string | null; fcmToken: string | null };
      driver: { fullName: string | null; fcmToken: string | null };
    },
    caller: 'customer' | 'driver',
  ) {
    const token =
      caller === 'customer'
        ? order.driver.fcmToken?.trim()
        : order.user.fcmToken?.trim();
    if (!token) {
      return;
    }
    const name =
      caller === 'customer'
        ? order.user.fullName?.trim() || 'Customer'
        : order.driver.fullName?.trim() || 'Driver';
    await this.notifications.sendOrderCallInvite({
      fcmToken: token,
      orderId,
      title: 'Incoming call',
      body: `${name} is calling you about your delivery`,
      recipientRole: caller === 'customer' ? 'driver' : 'user',
    });
  }
}
