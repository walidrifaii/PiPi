import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtUserPayload } from './jwt-user.payload';

/** Allows only logged-in delivery drivers (JWT role DRIVER). */
@Injectable()
export class DriverAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>().user;
    if (user?.role === 'DRIVER') {
      return true;
    }
    throw new ForbiddenException('Driver account required');
  }
}
