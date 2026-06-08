function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Steady limit: max requests per window (default 120 / minute). */
export const V2_RATE_LIMIT = {
  ttlMs: readInt('V2_RATE_LIMIT_TTL_MS', 60_000),
  max: readInt('V2_RATE_LIMIT_MAX', 120),
  blockMs: readInt('V2_RATE_LIMIT_BLOCK_MS', 120_000),
};

/** Burst limit: stops rapid scripted floods (default 30 / 10 seconds). */
export const V2_BURST_LIMIT = {
  ttlMs: readInt('V2_RATE_LIMIT_BURST_TTL_MS', 10_000),
  max: readInt('V2_RATE_LIMIT_BURST_MAX', 30),
  blockMs: readInt('V2_RATE_LIMIT_BURST_BLOCK_MS', 60_000),
};
