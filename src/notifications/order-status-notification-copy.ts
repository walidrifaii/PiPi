import { pickLocalized } from '../common/i18n/localized-text';
import type { AppLocale } from '../common/i18n/locale.types';

type OrderStatusCopy = { title: string; body: string };

const ORDER_STATUS_COPY_EN: Record<string, OrderStatusCopy> = {
  ACCEPTED: {
    title: 'Order accepted',
    body: '{store} accepted your order.',
  },
  PREPARING: {
    title: 'Order preparing',
    body: '{store} is preparing your order.',
  },
  READY: {
    title: 'Order ready',
    body: 'Your order from {store} is ready.',
  },
  DISPATCHED: {
    title: 'Order picked up',
    body: 'Your driver picked up your order from {store} and is on the way to you.',
  },
  DELIVERING: {
    title: 'Delivery accepted',
    body: 'A driver accepted your order from {store}. You can track it now.',
  },
  DELIVERED: {
    title: 'Delivered',
    body: 'Your order from {store} was delivered.',
  },
  CANCELLED: {
    title: 'Order cancelled',
    body: 'Your order from {store} was cancelled.',
  },
  DEFAULT: {
    title: 'Order update',
    body: 'Status updated for your order from {store}.',
  },
};

const ORDER_STATUS_COPY_AR: Record<string, OrderStatusCopy> = {
  ACCEPTED: {
    title: 'تم قبول الطلب',
    body: 'قبل {store} طلبك.',
  },
  PREPARING: {
    title: 'جاري التحضير',
    body: '{store} يحضّر طلبك الآن.',
  },
  READY: {
    title: 'الطلب جاهز',
    body: 'طلبك من {store} أصبح جاهزاً.',
  },
  DISPATCHED: {
    title: 'تم استلام الطلب',
    body: 'استلم السائق طلبك من {store} وهو في الطريق إليك.',
  },
  DELIVERING: {
    title: 'تم قبول التوصيل',
    body: 'قبل سائق طلبك من {store}. يمكنك تتبعه الآن.',
  },
  DELIVERED: {
    title: 'تم التوصيل',
    body: 'تم توصيل طلبك من {store}.',
  },
  CANCELLED: {
    title: 'تم إلغاء الطلب',
    body: 'تم إلغاء طلبك من {store}.',
  },
  DEFAULT: {
    title: 'تحديث الطلب',
    body: 'تم تحديث حالة طلبك من {store}.',
  },
};

function applyStore(template: string, store: string): string {
  return template.replaceAll('{store}', store);
}

/** Bilingual notification title/body for order status (inbox + optional FCM). */
export function orderStatusNotificationCopy(
  status: string,
  merchantName?: string,
  merchantNameAr?: string | null,
): {
  title: string;
  titleAr: string;
  body: string;
  messageAr: string;
} {
  const storeEn = merchantName?.trim() || 'your order';
  const storeAr = merchantNameAr?.trim() || storeEn;
  const normalized = (status ?? 'PENDING').trim().toUpperCase();
  const en =
    ORDER_STATUS_COPY_EN[normalized] ?? ORDER_STATUS_COPY_EN.DEFAULT;
  const ar =
    ORDER_STATUS_COPY_AR[normalized] ?? ORDER_STATUS_COPY_AR.DEFAULT;

  return {
    title: applyStore(en.title, storeEn),
    titleAr: applyStore(ar.title, storeAr),
    body: applyStore(en.body, storeEn),
    messageAr: applyStore(ar.body, storeAr),
  };
}

/** Pick push/inbox line for a user locale. */
export function pickOrderStatusPushCopy(
  copy: ReturnType<typeof orderStatusNotificationCopy>,
  locale: AppLocale = 'en',
): { title: string; body: string } {
  return {
    title: pickLocalized(copy.title, copy.titleAr, locale) ?? copy.title,
    body: pickLocalized(copy.body, copy.messageAr, locale) ?? copy.body,
  };
}
