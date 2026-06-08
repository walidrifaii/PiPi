import { Global, Module } from '@nestjs/common';
import { AppRedisService } from './app-redis.service';

@Global()
@Module({
  providers: [AppRedisService],
  exports: [AppRedisService],
})
export class AppRedisModule {}
