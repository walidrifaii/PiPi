import { Module } from '@nestjs/common';
import { RedisThrottleService } from './redis-throttle.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  providers: [RedisThrottleService, RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class V2ThrottlingStorageModule {}
