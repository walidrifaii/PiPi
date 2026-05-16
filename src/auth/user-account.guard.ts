import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtUserPayload } from './jwt-user.payload';

/** Allows only logged-in app users (JWT role USER). */
@Injectable()
export class UserAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>().user;
    if (user?.role === 'USER') {
      return true;
    }
    throw new ForbiddenException('User account required');
  }
}
