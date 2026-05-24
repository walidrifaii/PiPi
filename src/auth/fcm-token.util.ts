export function normalizeFcmToken(token?: string | null): string | undefined {
  const trimmed = token?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
