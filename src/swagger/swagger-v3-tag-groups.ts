/**
 * Swagger UI `x-tagGroups` for `/api/v3` — v3 endpoints only.
 */
export const SWAGGER_V3_TAG_GROUPS: Array<{ name: string; tags: string[] }> = [
  { name: 'V3 · Super Admin', tags: ['Super Admin'] },
  { name: 'V3 · Super Admin — Banners', tags: ['Super Admin · Banners'] },
  { name: 'V3 · Super Admin — Offers', tags: ['Super Admin · Offers'] },
  {
    name: 'V3 · Super Admin — Delivery Fees',
    tags: ['Super Admin · Delivery Fees'],
  },
  {
    name: 'V3 · Super Admin — Pickup',
    tags: ['Super Admin · Pickup'],
  },
  { name: 'V3 · Merchant', tags: ['Merchant'] },
  {
    name: 'V3 · Storefront',
    tags: ['V3 · Storefront', 'Storefront', 'Storefront · Menu'],
  },
  {
    name: 'V3 · Customer',
    tags: [
      'Customer',
      'V3 · Customer · Addresses',
      'V3 · Customer · Checkout',
      'V3 · Customer · Pickup',
    ],
  },
  {
    name: 'V3 · Product Options',
    tags: ['V3 · Product Options', 'V3 · Product Options · Merchant'],
  },
  { name: 'V3 · Delivery', tags: ['Delivery', 'V3 · Delivery · Pickup'] },
  { name: 'V3 · Shared', tags: ['Shared'] },
  { name: 'V3 · Coupons', tags: ['Coupons'] },
];
