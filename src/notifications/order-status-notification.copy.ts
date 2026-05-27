/** Notification title/body for order status pushes (kept out of orders/ to avoid circular imports). */
export function orderStatusNotificationCopy(
  status: string,
  merchantName?: string,
): { title: string; body: string } {
  const store = merchantName?.trim() || 'your order';
  const normalized = (status ?? 'PENDING').trim().toUpperCase();

  switch (normalized) {
    case 'ACCEPTED':
      return {
        title: 'Order accepted',
        body: `${store} accepted your order. You can track it in the app.`,
      };
    case 'PREPARING':
      return {
        title: 'Order preparing',
        body: `${store} is preparing your order.`,
      };
    case 'READY':
      return {
        title: 'Order ready',
        body: `Your order from ${store} is ready.`,
      };
    case 'DISPATCHED':
    case 'DELIVERING':
      return {
        title: 'On the way',
        body: `Your order from ${store} is on the way.`,
      };
    case 'DELIVERED':
      return {
        title: 'Delivered',
        body: `Your order from ${store} was delivered.`,
      };
    case 'CANCELLED':
      return {
        title: 'Order cancelled',
        body: `Your order from ${store} was cancelled.`,
      };
    default:
      return {
        title: 'Order update',
        body: `Status updated for your order from ${store}.`,
      };
  }
}
