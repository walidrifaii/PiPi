import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly log = new Logger(TrackingService.name);

  /** Server-side throttle: max 1 location write per driver per second. */
  private readonly lastDriverWriteMs = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  isFirestoreConfigured(): boolean {
    return this.firebase.firestore != null;
  }

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

  /**
   * Food orders and pickup jobs share the same RTDB paths (`orders/{id}`).
   * Pickup IDs are UUIDs too, so the driver app can start tracking with either.
   */
  private async findTrackableJob(jobId: string): Promise<{
    id: string;
    userId: string;
    driverId: string | null;
    status: string | null;
  } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true, driverId: true, status: true },
    });
    if (order) {
      return order;
    }
    return this.prisma.pickupOrder.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true, driverId: true, status: true },
    });
  }

  /** Assign driver to order/pickup and publish RTDB meta for security rules. */
  async startDriverTracking(driverId: string, orderId: string) {
    const order = await this.findTrackableJob(orderId);
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
    const order = await this.findTrackableJob(orderId);
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
        lat: null,
        lng: null,
        accuracy: null,
        heading: null,
        speed: null,
        stoppedAt: Date.now(),
      });
      await db.ref(`orders/${orderId}/tracking/location`).remove();
    }
    return { orderId, active: false };
  }

  /** Driver GPS via HTTP only (no client → Firebase writes). Throttled server-side. */
  async updateDriverLocation(
    driverId: string,
    orderId: string,
    payload: TrackingLocationPayload,
  ) {
    const order = await this.findTrackableJob(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }

    if (!this.acceptThrottledWrite(driverId, payload)) {
      return { ok: true as const, throttled: true as const };
    }

    await this.writeLocation(orderId, order.userId, driverId, payload);
    return { ok: true as const };
  }

  /** Customer polling fallback — reads last driver GPS from RTDB via Admin SDK. */
  async getCustomerTrackingLocation(userId: string, orderId: string) {
    const order = await this.findTrackableJob(orderId);
    if (!order || order.userId !== userId) {
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

    const orderSnap = await db.ref(`orders/${orderId}/tracking/location`).get();
    const fromOrder = this.parseRtdbLocation(orderSnap.val());
    if (fromOrder) {
      return { location: fromOrder };
    }

    const driverSnap = await db.ref(`drivers/${order.driverId}`).get();
    const fromDriver = this.parseRtdbDriverLocation(
      driverSnap.val(),
      orderId,
      order.driverId,
    );
    return { location: fromDriver };
  }

  /** Order-scoped GPS node (lat/lng only). */
  private parseRtdbLocation(val: unknown): Record<string, unknown> | null {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return null;
    }
    const row = val as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return null;
    }
    return row;
  }

  /** Driver-wide GPS node — ignore stale/inactive or wrong-order snapshots. */
  private parseRtdbDriverLocation(
    val: unknown,
    orderId: string,
    driverId: string,
  ): Record<string, unknown> | null {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return null;
    }
    const row = val as Record<string, unknown>;
    if (row.active === false) {
      return null;
    }
    const snapOrderId = row.orderId?.toString();
    if (snapOrderId && snapOrderId !== orderId) {
      return null;
    }
    const snapDriverId = row.driverId?.toString();
    if (snapDriverId && snapDriverId !== driverId) {
      return null;
    }
    return this.parseRtdbLocation(row);
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
    if (!firestore) {
      this.log.warn(
        `Firestore not configured — order ${orderId} meta not written (chat/call rules will deny client writes).`,
      );
      return;
    }
    await firestore.collection('orders').doc(orderId).set(meta, { merge: true });
  }

  /** Sync Firestore meta and confirm participant uids are readable before client opens chat. */
  async ensureOrderMetaSynced(
    orderId: string,
    userId: string,
    driverId: string,
  ): Promise<boolean> {
    const expectedUserUid = `user:${userId}`;
    const expectedDriverUid = `driver:${driverId}`;
    const firestore = this.firebase.firestore;

    if (!firestore) {
      await this.syncOrderMeta(orderId, userId, driverId);
      return false;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.syncOrderMeta(orderId, userId, driverId);
      const snap = await firestore.collection('orders').doc(orderId).get();
      const data = snap.data();
      if (
        data?.userUid === expectedUserUid &&
        data?.driverUid === expectedDriverUid
      ) {
        return true;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }

    this.log.warn(
      `Order meta verify failed for ${orderId} after sync attempts`,
    );
    return false;
  }

  /** At least every 3s to RTDB; otherwise max 1 write/sec when moving. */
  private acceptThrottledWrite(
    driverId: string,
    payload: TrackingLocationPayload,
  ): boolean {
    const now = Date.now();
    const last = this.lastDriverWriteMs.get(driverId) ?? 0;
    const elapsed = now - last;

    if (elapsed >= 3000) {
      this.lastDriverWriteMs.set(driverId, now);
      return true;
    }
    if (elapsed < 1000) {
      return false;
    }

    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
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

    await db.ref(`drivers/${driverId}`).update({
      ...location,
      driverId,
      orderId,
      active: true,
    });

    await db.ref(`orders/${orderId}/tracking/location`).set({
      ...location,
      orderId,
      driverId,
    });
  }
}
