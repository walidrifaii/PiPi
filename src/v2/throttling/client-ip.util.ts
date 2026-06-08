function firstForwardedIp(forwarded: string): string | null {
  const first = forwarded.split(',')[0]?.trim();
  return first || null;
}

/** Client IP for rate limiting (respects Express trust proxy). */
export function getClientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const headers = req.headers ?? {};
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const ip = firstForwardedIp(forwarded);
    if (ip) return ip;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].trim();
  }

  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}
