import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

export type DriverOfferLivePayload = {
  orderId: string;
  merchantId: string;
  merchantName: string;
  status: string;
  deliveryFee?: number;
  updatedAt: number;
  active: boolean;
};

/** RTDB feed for driver apps — new offers appear without manual refresh. */
@Injectable()
export class DriverOffersLiveService {
  private readonly log = new Logger(DriverOffersLiveService.name);

  constructor(private readonly firebase: FirebaseAdminService) {}

  async publishOffer(payload: Omit<DriverOfferLivePayload, 'updatedAt' | 'active'>) {
    const db = this.firebase.database;
    if (!db) {
      this.log.warn('RTDB not configured — driver offer live feed skipped');
      return;
    }

    const row: DriverOfferLivePayload = {
      ...payload,
      updatedAt: Date.now(),
      active: true,
    };

    await db.ref(`driverOffers/${payload.orderId}`).set(row);
  }

  async removeOffer(orderId: string) {
    const db = this.firebase.database;
    if (!db) {
      return;
    }
    await db.ref(`driverOffers/${orderId}`).remove();
  }
}
