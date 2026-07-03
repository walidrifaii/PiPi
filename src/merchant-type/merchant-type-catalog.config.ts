/** Merchant types that use aisle-style category images in catalog UI. */
export const MERCHANT_TYPES_WITH_CATEGORY_IMAGES = new Set([
  'SUPERMARKET',
  'PHARMACY',
]);

export function merchantTypeUsesCategoryImages(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return MERCHANT_TYPES_WITH_CATEGORY_IMAGES.has(code.trim().toUpperCase());
}
