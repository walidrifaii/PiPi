export function driverOfferNotificationCopy(params: {
  merchantName: string;
  deliveryFee?: number;
}): { title: string; body: string } {
  const store = params.merchantName?.trim() || 'A store';
  const fee =
    params.deliveryFee != null &&
    Number.isFinite(params.deliveryFee) &&
    params.deliveryFee > 0
      ? params.deliveryFee.toFixed(2)
      : null;
  return {
    title: 'New delivery offer',
    body: fee
      ? `${store} accepted an order · delivery ${fee}`
      : `${store} accepted an order — tap to view`,
  };
}
