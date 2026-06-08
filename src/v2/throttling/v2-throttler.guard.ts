import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type {
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { getClientIp } from './client-ip.util';
import { isV2Request } from './is-v2-request.util';
import { resolveV2Tracker } from './resolve-v2-tracker';

@Injectable()
export class V2ThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (!isV2Request(context)) {
      return true;
    }
    return super.shouldSkip(context);
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(resolveV2Tracker(req));
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return `v2:${super.generateKey(context, suffix, name)}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const retryAfter = Math.max(
      1,
      detail.timeToBlockExpire || detail.timeToExpire || 30,
    );

    res.setHeader('Retry-After', String(retryAfter));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests, please try again later',
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
