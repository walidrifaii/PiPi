export const ORDER_UPDATED_FCM_TYPE = 'order_updated' as const;

export type OrderUpdatedAction = 'updated' | 'deleted';

export type OrderUpdatedFcmData = {
  type: typeof ORDER_UPDATED_FCM_TYPE;
  orderId: string;
  merchantId: string;
  action: OrderUpdatedAction;
};

export function buildOrderUpdatedFcmData(
  orderId: string,
  merchantId: string,
  action: OrderUpdatedAction = 'updated',
): Record<string, string> {
  return {
    type: ORDER_UPDATED_FCM_TYPE,
    orderId,
    merchantId,
    action,
  };
}
