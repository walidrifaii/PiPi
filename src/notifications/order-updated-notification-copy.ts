export function orderUpdatedNotificationCopy(params: {
  merchantName: string;
  action?: 'updated' | 'deleted';
  checkoutRef?: string | null;
}): { title: string; body: string; titleAr: string; messageAr: string } {
  const merchant = params.merchantName.trim() || 'the store';
  const ref = params.checkoutRef?.trim();
  const refLabel = ref ? ` #${ref.slice(-6).toUpperCase()}` : '';

  if (params.action === 'deleted') {
    return {
      title: 'Order removed',
      titleAr: 'تم حذف الطلب',
      body: `Your order${refLabel} from ${merchant} was removed by support.`,
      messageAr: `تم حذف طلبك${refLabel} من ${merchant} بواسطة الدعم.`,
    };
  }

  return {
    title: 'Order updated',
    titleAr: 'تم تحديث الطلب',
    body: `Your order${refLabel} from ${merchant} was updated by support.`,
    messageAr: `تم تحديث طلبك${refLabel} من ${merchant} بواسطة الدعم.`,
  };
}

export function orderUpdatedStakeholderCopy(params: {
  action?: 'updated' | 'deleted';
  checkoutRef?: string | null;
  merchantName?: string;
}): { title: string; body: string } {
  const ref = params.checkoutRef?.trim();
  const refLabel = ref ? `#${ref.slice(-6).toUpperCase()}` : 'an order';
  const store = params.merchantName?.trim();

  if (params.action === 'deleted') {
    return {
      title: 'Order removed',
      body: store
        ? `Support removed ${refLabel} at ${store}.`
        : `Support removed ${refLabel}.`,
    };
  }

  return {
    title: 'Order updated',
    body: store
      ? `Support updated items on ${refLabel} at ${store}.`
      : `Support updated items on ${refLabel}.`,
  };
}
