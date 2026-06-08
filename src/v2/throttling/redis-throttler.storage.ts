import { Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import type Redis from 'ioredis';
import { RedisThrottleService } from './redis-throttle.service';

type ThrottleRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new ThrottlerStorageService();
  private warnedFallback = false;

  constructor(private readonly redis: RedisThrottleService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleRecord> {
    const client = await this.redis.getClient();
    if (!client) {
      return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    try {
      return await this.incrementRedis(
        client,
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    } catch (err) {
      if (!this.warnedFallback) {
        this.warnedFallback = true;
        this.logger.warn(
          `Redis rate-limit error; falling back to in-memory (${String(err)})`,
        );
      }
      return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  private async incrementRedis(
    client: Redis,
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleRecord> {
    const hitsKey = `${key}:hits:${throttlerName}`;
    const blockKey = `${key}:block:${throttlerName}`;

    const blockTtlMs = await client.pttl(blockKey);
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(1, Math.ceil(blockTtlMs / 1000)),
      };
    }

    const hits = await client.incr(hitsKey);
    let hitWindowTtlMs = await client.pttl(hitsKey);
    if (hitWindowTtlMs < 0) {
      await client.pexpire(hitsKey, ttl);
      hitWindowTtlMs = ttl;
    }

    const timeToExpire = Math.max(1, Math.ceil(hitWindowTtlMs / 1000));

    if (hits > limit) {
      await client.set(blockKey, '1', 'PX', blockDuration);
      return {
        totalHits: hits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.max(1, Math.ceil(blockDuration / 1000)),
      };
    }

    return {
      totalHits: hits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
