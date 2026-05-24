export const ORDER_STATUS_FCM_TYPE = 'order_status' as const;

export type OrderStatusFcmData = {
  type: typeof ORDER_STATUS_FCM_TYPE;
  orderId: string;
  status: string;
};

export function buildOrderStatusFcmData(
  orderId: string,
  status: string,
): Record<string, string> {
  return {
    type: ORDER_STATUS_FCM_TYPE,
    orderId,
    status: status.trim().toUpperCase(),
  };
}

export function parseOrderStatusFcmData(
  data: Record<string, unknown> | undefined,
): OrderStatusFcmData | null {
  if (!data || data.type !== ORDER_STATUS_FCM_TYPE) {
    return null;
  }
  const orderId = data.orderId;
  const status = data.status;
  if (typeof orderId !== 'string' || !orderId.trim()) {
    return null;
  }
  if (typeof status !== 'string' || !status.trim()) {
    return null;
  }
  return {
    type: ORDER_STATUS_FCM_TYPE,
    orderId: orderId.trim(),
    status: status.trim().toUpperCase(),
  };
}
