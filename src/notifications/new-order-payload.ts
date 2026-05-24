export const NEW_ORDER_FCM_TYPE = 'new_order' as const;

export type NewOrderFcmData = {
  type: typeof NEW_ORDER_FCM_TYPE;
  orderId: string;
  merchantId: string;
};

export function buildNewOrderFcmData(
  orderId: string,
  merchantId: string,
): Record<string, string> {
  return {
    type: NEW_ORDER_FCM_TYPE,
    orderId,
    merchantId,
  };
}
