import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { orderStatusNotificationCopy } from './order-status-notification.copy';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';
import { buildNewOrderFcmData } from './new-order-payload';
import { newOrderNotificationCopy } from './new-order-notification.copy';
import { buildOrderStatusFcmData } from './order-status-payload';
import {
  OrderNotificationsPort,
  type SendNewOrderAlertParams,
  type SendNewOrderAlertResult,
  type SendOrderStatusParams,
  type SendOrderStatusResult,
} from './notifications.port';

export type { SendOrderStatusResult } from './notifications.port';

@Injectable()
export class NotificationsService
  extends OrderNotificationsPort
  implements OnModuleInit
{
  private readonly log = new Logger(NotificationsService.name);
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

  /**
   * Push order status to the customer's device. Does not throw when Firebase is
   * missing or the token is invalid — the order update should still succeed.
   */
  async sendOrderStatusUpdate(
    params: SendOrderStatusParams,
  ): Promise<SendOrderStatusResult> {
    if (!this.messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    const copy = orderStatusNotificationCopy(
      params.status,
      params.merchantName,
    );
    const data = buildOrderStatusFcmData(params.orderId, params.status);

    try {
      const messageId = await this.messaging.send({
        token: params.fcmToken,
        notification: {
          title: copy.title,
          body: copy.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'pip_pip_default',
          },
        },
      });
      return { sent: true, messageId };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.log.warn(
        `Order status push failed for order ${params.orderId}: ${reason}`,
      );
      return { sent: false, reason };
    }
  }

  /**
   * Notify merchant and super-admin devices about a new PENDING order.
   * Does not throw when Firebase is missing or tokens are invalid.
   */
  async sendNewOrderAlert(
    params: SendNewOrderAlertParams,
  ): Promise<SendNewOrderAlertResult> {
    const tokens = [
      ...new Set(
        params.tokens.map((t) => t.trim()).filter((t) => t.length > 0),
      ),
    ];
    if (tokens.length === 0) {
      return { sent: false, reason: 'no_tokens' };
    }
    if (!this.messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    const copy = newOrderNotificationCopy({
      merchantName: params.merchantName,
      customerName: params.customerName,
      total: params.total,
    });
    const data = buildNewOrderFcmData(params.orderId, params.merchantId);

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: copy.title,
          body: copy.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'pip_pip_default',
          },
        },
      });
      const successCount = response.successCount;
      const failureCount = response.failureCount;
      if (successCount === 0) {
        return {
          sent: false,
          successCount,
          failureCount,
          reason: 'all_failed',
        };
      }
      return { sent: true, successCount, failureCount };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.log.warn(
        `New order push failed for order ${params.orderId}: ${reason}`,
      );
      return { sent: false, reason };
    }
  }
}
