import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUserPayload } from './jwt-user.payload';

function parseJwtPayload(payload: unknown): JwtUserPayload {
  if (!payload || typeof payload !== 'object') {
    throw new UnauthorizedException('Invalid token');
  }
  const p = payload as Record<string, unknown>;
  if (p.typ === 'refresh') {
    throw new UnauthorizedException('Use an access token, not a refresh token');
  }
  const sub = p.sub;
  const email = p.email;
  const role = p.role;
  if (
    typeof sub !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string'
  ) {
    throw new UnauthorizedException('Invalid token');
  }
  if (role === 'SUPER_ADMIN') {
    return { sub, email, role: 'SUPER_ADMIN' };
  }
  if (role === 'MERCHANT') {
    const merchantId = p.merchantId;
    if (typeof merchantId !== 'string' || merchantId.length === 0) {
      throw new UnauthorizedException('Invalid merchant token');
    }
    return { sub, email, role: 'MERCHANT', merchantId };
  }
  if (role === 'USER') {
    return { sub, email, role: 'USER' };
  }
  if (role === 'DRIVER') {
    return { sub, email, role: 'DRIVER' };
  }
  throw new UnauthorizedException('Invalid token');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  validate(payload: unknown): JwtUserPayload {
    return parseJwtPayload(payload);
  }
}
