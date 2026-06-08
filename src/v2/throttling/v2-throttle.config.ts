import type { ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Guest / anonymous traffic (IP-based tracker). */
export const V2_ANONYMOUS_LIMIT = {
  ttlMs: readInt('V2_RATE_LIMIT_TTL_MS', 60_000),
  max: readInt('V2_RATE_LIMIT_ANONYMOUS_MAX', 60),
  blockMs: readInt('V2_RATE_LIMIT_BLOCK_MS', 60_000),
};

/** Authenticated customer app users. */
export const V2_USER_LIMIT = {
  max: readInt('V2_RATE_LIMIT_USER_MAX', 300),
};

/** Merchant + driver accounts (operational apps). */
export const V2_STAFF_LIMIT = {
  max: readInt('V2_RATE_LIMIT_STAFF_MAX', 500),
};

/** Super admin panel. */
export const V2_SUPER_ADMIN_LIMIT = {
  max: readInt('V2_RATE_LIMIT_SUPER_ADMIN_MAX', 1000),
};

/** Optional premium tier (set V2_RATE_LIMIT_PREMIUM_MAX when you add premium flag). */
export const V2_PREMIUM_LIMIT = {
  max: readInt('V2_RATE_LIMIT_PREMIUM_MAX', 2000),
};

/** Spike / bot protection — applies to every client (IP or user). */
export const V2_BURST_LIMIT = {
  ttlMs: readInt('V2_RATE_LIMIT_BURST_TTL_MS', 10_000),
  max: readInt('V2_RATE_LIMIT_BURST_MAX', 20),
  blockMs: readInt('V2_RATE_LIMIT_BURST_BLOCK_MS', 30_000),
};

export function resolveV2StandardLimit(context: ExecutionContext): number {
  const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
  const user = req.user;

  if (!user?.sub) {
    return V2_ANONYMOUS_LIMIT.max;
  }

  // Hook for future premium flag on JWT or DB lookup.
  if ((user as JwtUserPayload & { isPremium?: boolean }).isPremium) {
    return V2_PREMIUM_LIMIT.max;
  }

  switch (user.role) {
    case 'SUPER_ADMIN':
      return V2_SUPER_ADMIN_LIMIT.max;
    case 'MERCHANT':
    case 'DRIVER':
      return V2_STAFF_LIMIT.max;
    case 'USER':
    default:
      return V2_USER_LIMIT.max;
  }
}
