import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { orderStatusNotificationCopy, pickOrderStatusPushCopy } from './order-status-notification-copy';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';
import { buildNewOrderFcmData } from './new-order-payload';
import { newOrderNotificationCopy } from './new-order-notification-copy';
import { buildDriverOfferFcmData } from './driver-offer-payload';
import { driverOfferNotificationCopy } from './driver-offer-notification-copy';
import { buildOrderStatusFcmData } from './order-status-payload';
import { buildOrderUpdatedFcmData } from './order-updated-payload';
import { buildUserNotificationFcmData } from './user-notification-fcm-payload';
import {
  OrderNotificationsPort,
  type SendNewOrderAlertParams,
  type SendNewOrderAlertResult,
  type SendDriverOfferAlertParams,
  type SendDriverOfferAlertResult,
  type SendOrderStatusParams,
  type SendOrderStatusResult,
  type SendOrderUpdatedParams,
  type SendOrderUpdatedResult,
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

  /**
   * Promo/inbox push — same delivery path as order status (one FCM message per token).
   * Mobile app must handle data.type === "user_notification" (like "order_status").
   */
  async sendBroadcastPush(params: {
    recipients: Array<{ token: string; notificationId?: string }>;
    title: string;
    body: string;
    broadcastId: string;
    category: string;
  }): Promise<{
    sent: boolean;
    successCount: number;
    failureCount: number;
    reason?: string;
    failures?: Array<{ token: string; reason: string }>;
  }> {
    const recipients = params.recipients
      .map((r) => ({
        token: r.token.trim(),
        notificationId: r.notificationId,
      }))
      .filter((r) => r.token.length > 0);

    if (recipients.length === 0) {
      return {
        sent: false,
        successCount: 0,
        failureCount: 0,
        reason: 'no_tokens',
      };
    }

    const messaging = this.firebaseAdmin.messaging;
    if (!messaging) {
      return {
        sent: false,
        successCount: 0,
        failureCount: recipients.length,
        reason: 'not_configured',
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ token: string; reason: string }> = [];

    for (const recipient of recipients) {
      const data = buildUserNotificationFcmData({
        category: params.category,
        broadcastId: params.broadcastId,
        notificationId: recipient.notificationId,
      });

      try {
        await messaging.send({
          token: recipient.token,
          notification: {
            title: params.title,
            body: params.body,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'pip_pip_default',
            },
          },
        });
        successCount += 1;
      } catch (err) {
        failureCount += 1;
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ token: recipient.token, reason });
        this.log.warn(
          `Broadcast push failed for ${params.broadcastId}: ${reason}`,
        );
      }
    }

    return {
      sent: successCount > 0,
      successCount,
      failureCount,
      ...(failureCount > 0 ? { failures: failures.slice(0, 5) } : {}),
      ...(successCount === 0 && failureCount > 0
        ? { reason: 'all_failed' }
        : {}),
    };
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

    let push: { title: string; body: string };
    if (titleOverride.length > 0 && bodyOverride.length > 0) {
      push = { title: titleOverride, body: bodyOverride };
    } else {
      const bilingual = orderStatusNotificationCopy(
        String(params.status ?? ''),
        params.merchantName != null
          ? String(params.merchantName)
          : undefined,
        params.merchantNameAr,
      );
      push = pickOrderStatusPushCopy(bilingual, 'en');
    }
    const data = buildOrderStatusFcmData(params.orderId, params.status);

    try {
      const messageId = await messaging.send({
        token: params.fcmToken,
        notification: {
          title: push.title,
          body: push.body,
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

  /**
   * Notify all driver devices when a merchant accepts an order (status ACCEPTED).
   */
  async sendDriverOfferAlert(
    params: SendDriverOfferAlertParams,
  ): Promise<SendDriverOfferAlertResult> {
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

    const copy = driverOfferNotificationCopy({
      merchantName: params.merchantName,
      deliveryFee: params.deliveryFee,
    });
    const data = buildDriverOfferFcmData(params.orderId, params.merchantId);

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
        `Driver offer push failed for order ${params.orderId}: ${reason}`,
      );
      return { sent: false, reason };
    }
  }

  /**
   * Notify customer / merchant / driver devices that an order was edited or deleted.
   * Does not throw when Firebase is missing or tokens are invalid.
   */
  async sendOrderUpdated(
    params: SendOrderUpdatedParams,
  ): Promise<SendOrderUpdatedResult> {
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

    const data = buildOrderUpdatedFcmData(
      params.orderId,
      params.merchantId,
      params.action ?? 'updated',
    );

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: params.title,
          body: params.body,
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
        `Order updated push failed for order ${params.orderId}: ${reason}`,
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
            channelId: 'pip_pip_chat',
            sound: 'road_runner_beep_beep',
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
          ...(params.callerName
            ? { callerName: params.callerName }
            : {}),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'pip_pip_calls',
            sound: 'road_runner_beep_beep',
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
