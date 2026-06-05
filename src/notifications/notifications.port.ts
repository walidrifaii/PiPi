export type SendOrderStatusResult = {
  sent: boolean;
  messageId?: string;
  reason?: string;
};

export type SendOrderStatusParams = {
  fcmToken: string;
  orderId: string;
  status: string;
  merchantName?: string;
  /** Optional override (e.g. driver accepted delivery). */
  title?: string;
  body?: string;
};

export type SendNewOrderAlertParams = {
  tokens: string[];
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerName?: string;
  total: number;
};

export type SendNewOrderAlertResult = {
  sent: boolean;
  successCount?: number;
  failureCount?: number;
  reason?: string;
};

export type SendDriverOfferAlertParams = {
  tokens: string[];
  orderId: string;
  merchantId: string;
  merchantName: string;
  deliveryFee?: number;
};

export type SendDriverOfferAlertResult = {
  sent: boolean;
  successCount?: number;
  failureCount?: number;
  reason?: string;
};

export type SendOrderChatMessageParams = {
  fcmToken: string;
  orderId: string;
  title: string;
  body: string;
  recipientRole: 'user' | 'driver';
};

export type SendOrderChatMessageResult = {
  sent: boolean;
  messageId?: string;
  reason?: string;
};

export type SendOrderCallInviteParams = {
  /** FCM data: `user` or `driver` — who receives the push */
  recipientRole: 'user' | 'driver';
  fcmToken: string;
  orderId: string;
  title: string;
  body: string;
  callerName?: string;
};

/** Injection token for order push notifications (avoids orders ↔ notifications type cycles). */
export abstract class OrderNotificationsPort {
  abstract sendOrderStatusUpdate(
    params: SendOrderStatusParams,
  ): Promise<SendOrderStatusResult>;

  abstract sendNewOrderAlert(
    params: SendNewOrderAlertParams,
  ): Promise<SendNewOrderAlertResult>;

  abstract sendDriverOfferAlert(
    params: SendDriverOfferAlertParams,
  ): Promise<SendDriverOfferAlertResult>;
}
