import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private messaging: admin.messaging.Messaging | null = null;

  onModuleInit() {
    this.messaging = this.tryInitFirebaseAdmin();
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

  private tryInitFirebaseAdmin(): admin.messaging.Messaging | null {
    if (admin.apps.length > 0) {
      return admin.messaging();
    }

    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

    let serviceAccount: admin.ServiceAccount | null = null;

    if (jsonEnv) {
      try {
        const parsed: unknown = JSON.parse(jsonEnv);
        if (this.isGoogleServicesJson(parsed)) {
          console.warn(
            '[Notifications] FIREBASE_SERVICE_ACCOUNT_JSON looks like google-services.json (mobile app config). Download a service account key instead: Firebase Console → Project settings → Service accounts → Generate new private key.',
          );
          return null;
        }
        serviceAccount = parsed as admin.ServiceAccount;
        if (!this.isServiceAccountJson(serviceAccount)) {
          console.warn(
            '[Notifications] FIREBASE_SERVICE_ACCOUNT_JSON must be a Firebase service account key (fields: type, project_id, private_key, client_email).',
          );
          return null;
        }
      } catch {
        console.warn(
          '[Notifications] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.',
        );
        return null;
      }
    } else if (pathEnv) {
      try {
        const raw = readFileSync(pathEnv, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (this.isGoogleServicesJson(parsed)) {
          console.warn(
            '[Notifications] FIREBASE_SERVICE_ACCOUNT_PATH points to google-services.json. Use a service account JSON from Firebase Console → Service accounts.',
          );
          return null;
        }
        serviceAccount = parsed as admin.ServiceAccount;
        if (!this.isServiceAccountJson(serviceAccount)) {
          console.warn(
            '[Notifications] FIREBASE_SERVICE_ACCOUNT_PATH must be a service account key file.',
          );
          return null;
        }
      } catch (err) {
        console.warn(
          `[Notifications] Could not read FIREBASE_SERVICE_ACCOUNT_PATH: ${String(err)}`,
        );
        return null;
      }
    } else {
      console.warn(
        '[Notifications] Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH to send push notifications.',
      );
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.messaging();
  }

  private assertMessaging(): admin.messaging.Messaging {
    if (!this.messaging) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON with a service account key (not google-services.json). Firebase Console → Project settings → Service accounts → Generate new private key.',
      );
    }
    return this.messaging;
  }

  async sendTestNotification(dto: SendTestNotificationDto) {
    const messaging = this.assertMessaging();

    const messageId = await messaging.send({
      token: dto.token,
      notification: {
        title: dto.title ?? 'PipPip test',
        body: dto.body ?? 'This is a test push notification from the API.',
      },
      data: dto.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'pip_pip_default',
        },
      },
    });

    return {
      ok: true as const,
      messageId,
      message: 'Notification sent',
    };
  }
}
