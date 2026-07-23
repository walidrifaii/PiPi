export const ORDER_UPDATED_FCM_TYPE = 'order_updated' as const;

export type OrderUpdatedFcmData = {
  type: typeof ORDER_UPDATED_FCM_TYPE;
  orderId: string;
  merchantId: string;
};

export function buildOrderUpdatedFcmData(
  orderId: string,
  merchantId: string,
): Record<string, string> {
  return {
    type: ORDER_UPDATED_FCM_TYPE,
    orderId,
    merchantId,
  };
}
