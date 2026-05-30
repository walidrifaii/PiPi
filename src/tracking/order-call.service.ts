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
  callId: string;
  appId: string;
  channel: string;
  token: string;
  uid: number;
  peerName: string;
};

type OrderCallFirestore = {
  callId: string;
  channel: string;
  status: string;
  startedBy: 'user' | 'driver';
  startedAt: number;
  callerName?: string;
  active: boolean;
  durationSeconds?: number;
};

@Injectable()
export class OrderCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  private channelForCallId(callId: string): string {
    const safe = callId.replace(/-/g, '').replace(/\//g, '_');
    const raw = `pip_voice_${safe}`;
    return raw.slice(0, 64);
  }

  private newCallId(orderId: string): string {
    const compact = orderId.replace(/-/g, '');
    return `${compact}_${Date.now()}`;
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

  private async readCallSignal(
    orderId: string,
  ): Promise<OrderCallFirestore | null> {
    const firestore = this.firebase.firestore;
    if (!firestore) {
      return null;
    }
    const snap = await firestore.collection('orders').doc(orderId).get();
    const call = snap.data()?.call;
    if (!call || typeof call !== 'object') {
      return null;
    }
    const c = call as Record<string, unknown>;
    const callId = String(c.callId ?? '');
    const channel = String(c.channel ?? '');
    if (!callId || !channel) {
      return null;
    }
    return {
      callId,
      channel,
      status: String(c.status ?? 'ringing'),
      startedBy: c.startedBy === 'driver' ? 'driver' : 'user',
      startedAt: Number(c.startedAt ?? 0),
      callerName:
        typeof c.callerName === 'string' ? c.callerName : undefined,
      active: c.active === true,
      durationSeconds:
        typeof c.durationSeconds === 'number'
          ? c.durationSeconds
          : undefined,
    };
  }

  private async writeCallSignal(
    orderId: string,
    call: OrderCallFirestore,
  ): Promise<void> {
    const firestore = this.firebase.firestore;
    if (!firestore) {
      return;
    }
    await firestore.collection('orders').doc(orderId).set(
      { call },
      { merge: true },
    );
  }

  private async clearStaleRinging(orderId: string): Promise<void> {
    const existing = await this.readCallSignal(orderId);
    if (!existing?.active || existing.status !== 'ringing') {
      return;
    }
    const ageMs = Date.now() - existing.startedAt;
    if (ageMs > 5 * 60 * 1000) {
      await this.writeCallSignal(orderId, {
        ...existing,
        status: 'missed',
        active: false,
      });
    }
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

    await this.clearStaleRinging(orderId);

    const callId = this.newCallId(orderId);
    const channel = this.channelForCallId(callId);
    const uid = this.uidForRole('USER');
    const token = this.buildAgoraToken(channel, uid);
    const callerName = order.user.fullName?.trim() || 'Customer';

    await this.writeCallSignal(orderId, {
      callId,
      channel,
      status: 'ringing',
      startedBy: 'user',
      startedAt: Date.now(),
      callerName,
      active: true,
      durationSeconds: 0,
    });

    const driver = order.driver!;
    await this.notifyIncomingCall(
      orderId,
      { user: order.user, driver },
      'customer',
    );

    return {
      orderId,
      callId,
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

    await this.clearStaleRinging(orderId);

    const callId = this.newCallId(orderId);
    const channel = this.channelForCallId(callId);
    const uid = this.uidForRole('DRIVER');
    const token = this.buildAgoraToken(channel, uid);
    const driver = order.driver!;
    const callerName = driver.fullName?.trim() || 'Driver';

    await this.writeCallSignal(orderId, {
      callId,
      channel,
      status: 'ringing',
      startedBy: 'driver',
      startedAt: Date.now(),
      callerName,
      active: true,
      durationSeconds: 0,
    });

    await this.notifyIncomingCall(
      orderId,
      { user: order.user, driver },
      'driver',
    );

    return {
      orderId,
      callId,
      appId: process.env.AGORA_APP_ID!.trim(),
      channel,
      token,
      uid,
      peerName: order.user.fullName?.trim() || 'Customer',
    };
  }

  async acceptCallForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderCallSessionDto> {
    const order = await this.assertOrderCall(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }

    const signal = await this.readCallSignal(orderId);
    if (!signal?.active || signal.status !== 'ringing') {
      throw new BadRequestException('No incoming call to accept');
    }
    if (signal.startedBy === 'user') {
      throw new BadRequestException('Cannot accept your own outgoing call');
    }

    const channel = signal.channel;
    const uid = this.uidForRole('USER');
    const token = this.buildAgoraToken(channel, uid);

    await this.writeCallSignal(orderId, {
      ...signal,
      status: 'accepted',
      active: true,
    });

    const driver = order.driver!;
    return {
      orderId,
      callId: signal.callId,
      appId: process.env.AGORA_APP_ID!.trim(),
      channel,
      token,
      uid,
      peerName: signal.callerName?.trim() || driver.fullName?.trim() || 'Driver',
    };
  }

  async acceptCallForDriver(
    driverId: string,
    orderId: string,
  ): Promise<OrderCallSessionDto> {
    const order = await this.assertOrderCall(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }

    const signal = await this.readCallSignal(orderId);
    if (!signal?.active || signal.status !== 'ringing') {
      throw new BadRequestException('No incoming call to accept');
    }
    if (signal.startedBy === 'driver') {
      throw new BadRequestException('Cannot accept your own outgoing call');
    }

    const channel = signal.channel;
    const uid = this.uidForRole('DRIVER');
    const token = this.buildAgoraToken(channel, uid);

    await this.writeCallSignal(orderId, {
      ...signal,
      status: 'accepted',
      active: true,
    });

    return {
      orderId,
      callId: signal.callId,
      appId: process.env.AGORA_APP_ID!.trim(),
      channel,
      token,
      uid,
      peerName:
        signal.callerName?.trim() || order.user.fullName?.trim() || 'Customer',
    };
  }

  async declineCallForUser(userId: string, orderId: string): Promise<void> {
    const order = await this.assertOrderCall(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    await this.declineCall(orderId, 'user');
  }

  async declineCallForDriver(driverId: string, orderId: string): Promise<void> {
    const order = await this.assertOrderCall(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }
    await this.declineCall(orderId, 'driver');
  }

  private async declineCall(
    orderId: string,
    role: 'user' | 'driver',
  ): Promise<void> {
    const signal = await this.readCallSignal(orderId);
    if (!signal?.active) {
      return;
    }
    if (signal.startedBy === role && signal.status === 'ringing') {
      await this.writeCallSignal(orderId, {
        ...signal,
        status: 'cancelled',
        active: false,
      });
      return;
    }
    await this.writeCallSignal(orderId, {
      ...signal,
      status: 'declined',
      active: false,
    });
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
      callerName: name,
    });
  }
}
