export function resolveProductDisplayImage(product: {
  imageUrl?: string | null;
  images?: Array<{ url: string }>;
}): string | null {
  const primary = product.imageUrl?.trim();
  if (primary) return primary;
  const gallery = product.images?.[0]?.url?.trim();
  return gallery || null;
}
