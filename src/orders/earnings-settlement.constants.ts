export const EARNINGS_SETTLEMENT_STATUS_PAID = 'PAID';

export type EarningsParticipantType = 'DRIVER' | 'MERCHANT';

export type PayoutStatus = 'PAID' | 'UNPAID';

export function parseSettlementOrderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === 'string');
}

export function generateSettlementReferenceCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${stamp}-${rand}`;
}
