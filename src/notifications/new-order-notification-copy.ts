export function newOrderNotificationCopy(params: {
  merchantName: string;
  customerName?: string;
  total: number;
}): { title: string; body: string } {
  const customer = params.customerName?.trim() || 'A customer';
  const total =
    Number.isFinite(params.total) && params.total > 0
      ? params.total.toFixed(2)
      : null;
  return {
    title: 'New order',
    body: total
      ? `${customer} placed an order at ${params.merchantName} · ${total}`
      : `${customer} placed an order at ${params.merchantName}`,
  };
}
