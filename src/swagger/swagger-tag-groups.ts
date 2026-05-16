/**
 * Swagger UI `x-tagGroups`: collapsible sections on `/api`.
 * Tag strings on controllers must match the `tags` entries exactly.
 */
export const SWAGGER_X_TAG_GROUPS: Array<{ name: string; tags: string[] }> = [
  { name: '1 · Super Admin', tags: ['Super Admin'] },
  { name: '1 · Super Admin — Banners', tags: ['Super Admin · Banners'] },
  { name: '2 · Merchant (store owner)', tags: ['Merchant'] },
  { name: '3 · Storefront (browse)', tags: ['Storefront'] },
  { name: '4 · Customer', tags: ['Customer'] },
  { name: '5 · Delivery (driver)', tags: ['Delivery'] },
  { name: '6 · Shared', tags: ['Shared'] },
];
