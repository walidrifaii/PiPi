/** Normalize user input to UPPER_SNAKE (letters, digits, underscore). */
export function normalizeMerchantTypeCode(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}
