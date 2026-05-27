import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly log = new Logger(FirebaseAdminService.name);
  private ready = false;

  onModuleInit() {
    this.ready = this.tryInitialize();
  }

  isConfigured(): boolean {
    return this.ready;
  }

  get messaging(): admin.messaging.Messaging | null {
    return this.ready ? admin.messaging() : null;
  }

  get database(): admin.database.Database | null {
    if (!this.ready) {
      return null;
    }
    if (!process.env.FIREBASE_DATABASE_URL?.trim()) {
      return null;
    }
    return admin.database();
  }

  get auth(): admin.auth.Auth | null {
    return this.ready ? admin.auth() : null;
  }

  databaseUrl(): string | null {
    const url = process.env.FIREBASE_DATABASE_URL?.trim();
    return url || null;
  }

  async createCustomToken(uid: string): Promise<string> {
    const auth = this.auth;
    if (!auth) {
      throw new Error('Firebase Admin is not configured');
    }
    return auth.createCustomToken(uid);
  }

  private isGoogleServicesJson(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'project_info' in value &&
      'client' in value
    );
  }

  private isServiceAccountJson(
    value: admin.ServiceAccount,
  ): value is admin.ServiceAccount {
    const v = value as Record<string, unknown>;
    return (
      v.type === 'service_account' &&
      typeof v.project_id === 'string' &&
      typeof v.private_key === 'string' &&
      typeof v.client_email === 'string'
    );
  }

  private loadServiceAccount(): admin.ServiceAccount | null {
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

    if (jsonEnv) {
      try {
        const parsed: unknown = JSON.parse(jsonEnv);
        if (this.isGoogleServicesJson(parsed)) {
          this.log.warn(
            'FIREBASE_SERVICE_ACCOUNT_JSON looks like google-services.json; use a service account key.',
          );
          return null;
        }
        const account = parsed as admin.ServiceAccount;
        if (!this.isServiceAccountJson(account)) {
          this.log.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not a service account key.');
          return null;
        }
        return account;
      } catch {
        this.log.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
        return null;
      }
    }

    if (pathEnv) {
      try {
        const raw = readFileSync(pathEnv, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (this.isGoogleServicesJson(parsed)) {
          this.log.warn('FIREBASE_SERVICE_ACCOUNT_PATH points to google-services.json.');
          return null;
        }
        const account = parsed as admin.ServiceAccount;
        if (!this.isServiceAccountJson(account)) {
          this.log.warn('FIREBASE_SERVICE_ACCOUNT_PATH is not a service account key.');
          return null;
        }
        return account;
      } catch (err) {
        this.log.warn(`Could not read FIREBASE_SERVICE_ACCOUNT_PATH: ${String(err)}`);
        return null;
      }
    }

    return null;
  }

  private tryInitialize(): boolean {
    if (admin.apps.length > 0) {
      return true;
    }

    const serviceAccount = this.loadServiceAccount();
    if (!serviceAccount) {
      this.log.warn(
        'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.',
      );
      return false;
    }

    const databaseURL = process.env.FIREBASE_DATABASE_URL?.trim();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(databaseURL ? { databaseURL } : {}),
    });
    return true;
  }
}
