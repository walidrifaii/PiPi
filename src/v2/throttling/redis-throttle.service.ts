import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottleService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottleService.name);
  private client: Redis | null = null;
  private connectAttempted = false;

  private createClient(): Redis | null {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return null;
    }

    return new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  async getClient(): Promise<Redis | null> {
    if (!this.client) {
      this.client = this.createClient();
    }
    if (!this.client) {
      return null;
    }

    if ((this.client.status as string) === 'ready') {
      return this.client;
    }

    if (!this.connectAttempted) {
      this.connectAttempted = true;
      try {
        await this.client.connect();
        this.logger.log('Redis connected for v2 rate limiting');
        return this.client;
      } catch (err) {
        this.logger.warn(
          `Redis unavailable for v2 rate limiting; using in-memory fallback (${String(err)})`,
        );
        await this.client.quit().catch(() => undefined);
        this.client = null;
        return null;
      }
    }

    return (this.client.status as string) === 'ready' ? this.client : null;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.quit().catch(() => undefined);
    this.client = null;
  }
}
