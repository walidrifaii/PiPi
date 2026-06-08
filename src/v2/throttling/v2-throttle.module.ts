import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  V2_ANONYMOUS_LIMIT,
  V2_BURST_LIMIT,
  resolveV2StandardLimit,
} from './v2-throttle.config';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { V2ThrottlingStorageModule } from './v2-throttling-storage.module';
import { V2ThrottlerGuard } from './v2-throttler.guard';

@Module({
  imports: [
    V2ThrottlingStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [V2ThrottlingStorageModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        setHeaders: true,
        throttlers: [
          {
            name: 'burst',
            ttl: V2_BURST_LIMIT.ttlMs,
            limit: V2_BURST_LIMIT.max,
            blockDuration: V2_BURST_LIMIT.blockMs,
          },
          {
            name: 'standard',
            ttl: V2_ANONYMOUS_LIMIT.ttlMs,
            limit: resolveV2StandardLimit,
            blockDuration: V2_ANONYMOUS_LIMIT.blockMs,
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: V2ThrottlerGuard,
    },
  ],
})
export class V2ThrottleModule {}
