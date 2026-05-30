import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { orderStatusNotificationCopy } from './order-status-notification-copy';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';
import { buildNewOrderFcmData } from './new-order-payload';
import { newOrderNotificationCopy } from './new-order-notification-copy';
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
export class NotificationsService extends OrderNotificationsPort {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly firebaseAdmin: FirebaseAdminService) {
    super();
  }

  private assertMessaging(): admin.messaging.Messaging {
    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON with a service account key (not google-services.json). Firebase Console → Project settings → Service accounts → Generate new private key.',
      );
    }
    return messaging;
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
    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    const titleOverride =
      params.title !== undefined && params.title !== null
        ? String(params.title).trim()
        : '';
    const bodyOverride =
      params.body !== undefined && params.body !== null
        ? String(params.body).trim()
        : '';

    const copy: { title: string; body: string } =
      titleOverride.length > 0 && bodyOverride.length > 0
        ? { title: titleOverride, body: bodyOverride }
        : orderStatusNotificationCopy(
            String(params.status ?? ''),
            params.merchantName != null
              ? String(params.merchantName)
              : undefined,
          );
    const data = buildOrderStatusFcmData(params.orderId, params.status);

    try {
      const messageId = await messaging.send({
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
    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    const copy = newOrderNotificationCopy({
      merchantName: params.merchantName,
      customerName: params.customerName,
      total: params.total,
    });
    const data = buildNewOrderFcmData(params.orderId, params.merchantId);

    try {
      const response = await messaging.sendEachForMulticast({
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

  /** Push for a new in-delivery chat message. Does not throw on failure. */
  async sendOrderChatMessage(
    params: import('./notifications.port').SendOrderChatMessageParams,
  ): Promise<import('./notifications.port').SendOrderChatMessageResult> {
    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    try {
      const messageId = await messaging.send({
        token: params.fcmToken,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: {
          type: 'order_chat',
          orderId: params.orderId,
          recipientRole: params.recipientRole,
        },
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
        `Chat push failed for order ${params.orderId}: ${reason}`,
      );
      return { sent: false, reason };
    }
  }

  async sendOrderCallInvite(
    params: import('./notifications.port').SendOrderCallInviteParams,
  ): Promise<import('./notifications.port').SendOrderChatMessageResult> {
    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      return { sent: false, reason: 'not_configured' };
    }

    try {
      const messageId = await messaging.send({
        token: params.fcmToken,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: {
          type: 'order_call',
          orderId: params.orderId,
          recipientRole: params.recipientRole,
        },
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
      this.log.warn(`Call invite push failed for order ${params.orderId}: ${reason}`);
      return { sent: false, reason };
    }
  }
}
