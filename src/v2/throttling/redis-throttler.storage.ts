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
      return await this.incrementSlidingWindow(
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

  /** Sliding window counter (shared across app instances via Redis). */
  private async incrementSlidingWindow(
    client: Redis,
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleRecord> {
    const windowKey = `${key}:sw:${throttlerName}`;
    const blockKey = `${key}:block:${throttlerName}`;
    const now = Date.now();

    const blockTtlMs = await client.pttl(blockKey);
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(1, Math.ceil(blockTtlMs / 1000)),
      };
    }

    await client.zremrangebyscore(windowKey, 0, now - ttl);
    const currentHits = await client.zcard(windowKey);

    if (currentHits >= limit) {
      await client.set(blockKey, '1', 'PX', blockDuration);
      return {
        totalHits: currentHits,
        timeToExpire: Math.max(1, Math.ceil(ttl / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.max(1, Math.ceil(blockDuration / 1000)),
      };
    }

    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    await client.zadd(windowKey, now, member);
    await client.pexpire(windowKey, ttl);

    const totalHits = currentHits + 1;
    const oldest = await client.zrange(windowKey, 0, 0, 'WITHSCORES');
    const oldestTs =
      oldest.length >= 2 ? Number.parseInt(oldest[1], 10) : now;
    const windowRemainingMs = Math.max(0, oldestTs + ttl - now);

    return {
      totalHits,
      timeToExpire: Math.max(1, Math.ceil(windowRemainingMs / 1000)),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
