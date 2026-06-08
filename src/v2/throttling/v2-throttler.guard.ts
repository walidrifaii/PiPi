import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { getClientIp } from './client-ip.util';
import { isV2Request } from './is-v2-request.util';

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

  protected getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub as string | undefined;
    if (userId) {
      return Promise.resolve(`user:${userId}`);
    }
    return Promise.resolve(`ip:${getClientIp(req)}`);
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return `v2:${super.generateKey(context, suffix, name)}`;
  }
}
