import type { ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';
import { getClientIp } from './client-ip.util';

/** Logged-in → userId bucket; guest → IP bucket. */
export function resolveV2Tracker(req: Record<string, unknown>): string {
  const user = req.user as JwtUserPayload | undefined;
  const userId = user?.sub;
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${getClientIp(req as Parameters<typeof getClientIp>[0])}`;
}

export function resolveV2TrackerFromContext(context: ExecutionContext): string {
  const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
  return resolveV2Tracker(req);
}
