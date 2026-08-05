/**
 * Remove all products and categories for merchant a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9 (ADO CREPE).
 *
 * Usage (from PiPi/):
 *   CONFIRM_DELETE_MERCHANT_CATALOG=yes node scripts/delete-merchant-a8d87c1e-catalog.mjs
 */
process.env.MERCHANT_ID ??= "a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9";
await import("./delete-merchant-catalog.mjs");
