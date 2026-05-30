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
import { isCustomerTrackableStatus } from '../orders/order-status.constants';

export type TrackingLocationPayload = {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
};

@Injectable()
export class TrackingService {
  /** Server-side throttle: max 1 location write per driver per second. */
  private readonly lastDriverWriteMs = new Map<string, number>();

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
      await db.ref(`drivers/${driverId}`).update({
        active: false,
        orderId: null,
        stoppedAt: Date.now(),
      });
    }
    return { orderId, active: false };
  }

  /** Driver GPS via HTTP only (no client → Firebase writes). Throttled server-side. */
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

    if (!this.acceptThrottledWrite(driverId)) {
      return { ok: true as const, throttled: true as const };
    }

    await this.writeLocation(orderId, order.userId, driverId, payload);
    return { ok: true as const };
  }

  /** Customer polling fallback — reads last driver GPS from RTDB via Admin SDK. */
  async getCustomerTrackingLocation(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { driverId: true, status: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!order.driverId || !isCustomerTrackableStatus(order.status)) {
      return { location: null as Record<string, unknown> | null };
    }

    await this.syncOrderMeta(orderId, userId, order.driverId);

    const db = this.firebase.database;
    if (!db) {
      return { location: null as Record<string, unknown> | null };
    }

    let snap = await db.ref(`drivers/${order.driverId}`).get();
    if (!snap.exists()) {
      snap = await db.ref(`orders/${orderId}/tracking/location`).get();
    }
    if (!snap.exists()) {
      return { location: null as Record<string, unknown> | null };
    }

    const val: unknown = snap.val();
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { location: null as Record<string, unknown> | null };
    }
    return { location: val as Record<string, unknown> };
  }

  async syncOrderMeta(orderId: string, userId: string, driverId: string) {
    const meta = {
      userUid: `user:${userId}`,
      driverUid: `driver:${driverId}`,
      active: true,
      updatedAt: Date.now(),
    };

    const db = this.firebase.database;
    if (db) {
      await db.ref(`orders/${orderId}/meta`).set(meta);
    }

    const firestore = this.firebase.firestore;
    if (firestore) {
      await firestore.collection('orders').doc(orderId).set(meta, { merge: true });
    }
  }

  private acceptThrottledWrite(driverId: string): boolean {
    const now = Date.now();
    const last = this.lastDriverWriteMs.get(driverId) ?? 0;
    if (now - last < 1000) {
      return false;
    }
    this.lastDriverWriteMs.set(driverId, now);
    return true;
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

    const updatedAt = Date.now();
    const location = {
      lat: payload.lat,
      lng: payload.lng,
      ...(payload.accuracy != null ? { accuracy: payload.accuracy } : {}),
      ...(payload.heading != null ? { heading: payload.heading } : {}),
      ...(payload.speed != null ? { speed: payload.speed } : {}),
      updatedAt,
    };

    await this.syncOrderMeta(orderId, userId, driverId);

    await db.ref(`drivers/${driverId}`).set({
      ...location,
      driverId,
      orderId,
      active: true,
    });

    await db.ref(`orders/${orderId}/tracking/location`).set(location);
  }
}
