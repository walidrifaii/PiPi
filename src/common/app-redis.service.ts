import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AppRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(AppRedisService.name);
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
        this.logger.log('Redis connected for app caching');
        return this.client;
      } catch (err) {
        this.logger.warn(
          `Redis unavailable for app caching (${String(err)})`,
        );
        await this.client.quit().catch(() => undefined);
        this.client = null;
        return null;
      }
    }

    return (this.client.status as string) === 'ready' ? this.client : null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }
    try {
      const raw = await client.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    const client = await this.getClient();
    if (!client || ttlSec <= 0) {
      return;
    }
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch {
      // cache miss on next read
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.quit().catch(() => undefined);
    this.client = null;
  }
}
