import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import type { JwtUserPayload } from '../auth/jwt-user.payload';

export type TrackingLocationPayload = {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
};

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  firebaseUidForJwt(user: JwtUserPayload): string {
    if (user.role === 'DRIVER') {
      return `driver:${user.sub}`;
    }
    if (user.role === 'USER') {
      return `user:${user.sub}`;
    }
    if (user.role === 'MERCHANT') {
      return `merchant:${user.merchantId}`;
    }
    return `admin:${user.sub}`;
  }

  async issueFirebaseCustomToken(user: JwtUserPayload) {
    if (!this.firebase.isConfigured()) {
      throw new ServiceUnavailableException(
        'Firebase is not configured on the server.',
      );
    }
    const databaseUrl = this.firebase.databaseUrl();
    if (!databaseUrl) {
      throw new ServiceUnavailableException(
        'FIREBASE_DATABASE_URL is not set. Enable Realtime Database in Firebase Console.',
      );
    }

    const uid = this.firebaseUidForJwt(user);
    const token = await this.firebase.createCustomToken(uid);
    return { token, databaseUrl, uid };
  }

  /** Assign driver to order and publish RTDB meta for security rules. */
  async startDriverTracking(driverId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.driverId) {
      throw new BadRequestException(
        'Accept the order first (POST /drivers/me/orders/:orderId/accept)',
      );
    }
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Order is assigned to another driver');
    }

    const terminal = new Set(['DELIVERED', 'CANCELLED']);
    const status = (order.status ?? 'PENDING').toUpperCase();
    if (terminal.has(status)) {
      throw new BadRequestException(`Cannot track order in status ${status}`);
    }

    await this.syncOrderMeta(orderId, order.userId, driverId);
    return { orderId, active: true };
  }

  async stopDriverTracking(driverId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { driverId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }

    const db = this.firebase.database;
    if (db) {
      await db.ref(`orders/${orderId}/meta`).update({
        active: false,
        stoppedAt: Date.now(),
      });
    }
    return { orderId, active: false };
  }

  /** Fallback when client cannot write to RTDB directly (same throttling on client). */
  async updateDriverLocation(
    driverId: string,
    orderId: string,
    payload: TrackingLocationPayload,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { driverId: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }

    await this.writeLocation(orderId, order.userId, driverId, payload);
    return { ok: true as const };
  }

  async syncOrderMeta(orderId: string, userId: string, driverId: string) {
    const db = this.firebase.database;
    if (!db) {
      return;
    }
    await db.ref(`orders/${orderId}/meta`).set({
      userUid: `user:${userId}`,
      driverUid: `driver:${driverId}`,
      active: true,
      updatedAt: Date.now(),
    });
  }

  private async writeLocation(
    orderId: string,
    userId: string,
    driverId: string,
    payload: TrackingLocationPayload,
  ) {
    const db = this.firebase.database;
    if (!db) {
      throw new ServiceUnavailableException('Firebase Realtime Database is not configured');
    }

    await this.syncOrderMeta(orderId, userId, driverId);
    await db.ref(`orders/${orderId}/tracking/location`).set({
      lat: payload.lat,
      lng: payload.lng,
      ...(payload.accuracy != null ? { accuracy: payload.accuracy } : {}),
      ...(payload.heading != null ? { heading: payload.heading } : {}),
      ...(payload.speed != null ? { speed: payload.speed } : {}),
      updatedAt: Date.now(),
    });
  }
}
