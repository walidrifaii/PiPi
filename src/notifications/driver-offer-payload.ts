export const DRIVER_OFFER_FCM_TYPE = 'driver_offer' as const;

export type DriverOfferFcmData = {
  type: typeof DRIVER_OFFER_FCM_TYPE;
  orderId: string;
  merchantId: string;
};

export function buildDriverOfferFcmData(
  orderId: string,
  merchantId: string,
): Record<string, string> {
  return {
    type: DRIVER_OFFER_FCM_TYPE,
    orderId,
    merchantId,
  };
}
