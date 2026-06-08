import { ExecutionContext } from '@nestjs/common';

export function isV2Request(context: ExecutionContext): boolean {
  if (context.getType() !== 'http') {
    return false;
  }

  const req = context.switchToHttp().getRequest<{ url?: string }>();
  const url = req.url ?? '';
  return url === '/v2' || url.startsWith('/v2/');
}
