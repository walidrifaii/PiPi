/** Sale applies only when discount is strictly below list price. */
export function resolveEffectiveUnitPrice(
  price: number,
  discountPrice?: number | null,
): number {
  const list = Number(price);
  const discount =
    discountPrice === undefined || discountPrice === null
      ? null
      : Number(discountPrice);
  const hasDiscount = discount !== null && discount < list;
  return hasDiscount ? discount : list;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function moneyEquals(a: number, b: number): boolean {
  return roundMoney(a) === roundMoney(b);
}

/** Validates client-sent list/discount prices against catalog values. */
export function clientPricesMatchCatalog(
  catalogPrice: number,
  catalogDiscount: number | null,
  clientPrice: number,
  clientDiscount?: number | null,
): boolean {
  if (!moneyEquals(catalogPrice, clientPrice)) {
    return false;
  }
  const catalogDisc =
    catalogDiscount !== null && catalogDiscount < catalogPrice
      ? catalogDiscount
      : null;
  if (clientDiscount === undefined || clientDiscount === null) {
    return catalogDisc === null;
  }
  if (catalogDisc === null) {
    return false;
  }
  return moneyEquals(catalogDisc, clientDiscount);
}
