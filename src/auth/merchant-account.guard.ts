import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtUserPayload } from './jwt-user.payload';

/** Allows only logged-in merchant accounts (JWT role MERCHANT with merchantId). */
@Injectable()
export class MerchantAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>().user;
    if (user?.role === 'MERCHANT' && user.merchantId) {
      return true;
    }
    throw new ForbiddenException('Merchant account required');
  }
}
