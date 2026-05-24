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

  private tryInitFirebaseAdmin(): admin.messaging.Messaging | null {
    if (admin.apps.length > 0) {
      return admin.messaging();
    }

    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

    let serviceAccount: admin.ServiceAccount | null = null;

    if (jsonEnv) {
      try {
        serviceAccount = JSON.parse(jsonEnv) as admin.ServiceAccount;
      } catch {
        console.warn(
          '[Notifications] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.',
        );
        return null;
      }
    } else if (pathEnv) {
      try {
        const raw = readFileSync(pathEnv, 'utf8');
        serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
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
        'Push notifications are not configured on the server. Add FIREBASE_SERVICE_ACCOUNT_JSON (service account JSON from Firebase Console) to your .env file.',
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
