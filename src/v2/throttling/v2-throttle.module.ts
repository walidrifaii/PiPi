import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { V2_BURST_LIMIT, V2_RATE_LIMIT } from './v2-throttle.config';
import { RedisThrottleService } from './redis-throttle.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { V2ThrottlerGuard } from './v2-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        setHeaders: true,
        throttlers: [
          {
            name: 'default',
            ttl: V2_RATE_LIMIT.ttlMs,
            limit: V2_RATE_LIMIT.max,
            blockDuration: V2_RATE_LIMIT.blockMs,
          },
          {
            name: 'burst',
            ttl: V2_BURST_LIMIT.ttlMs,
            limit: V2_BURST_LIMIT.max,
            blockDuration: V2_BURST_LIMIT.blockMs,
          },
        ],
      }),
    }),
  ],
  providers: [
    RedisThrottleService,
    RedisThrottlerStorage,
    {
      provide: APP_GUARD,
      useClass: V2ThrottlerGuard,
    },
  ],
})
export class V2ThrottleModule {}
