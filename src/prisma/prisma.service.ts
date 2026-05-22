import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import pg from 'pg';
import WebSocket from 'ws';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const msg = err.message.toLowerCase();
  if (
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('connection terminated due to connection timeout') ||
    msg.includes('connection timeout') ||
    msg.includes('timeout expired') ||
    msg.includes('timed out') ||
    msg.includes('server closed the connection') ||
    msg.includes('connection closed') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('broken pipe') ||
    msg.includes('read econnreset') ||
    msg.includes('write econnreset') ||
    msg.includes('the connection is closed') ||
    msg.includes('websocket') ||
    msg.includes('web socket')
  ) {
    return true;
  }
  const code = (err as NodeJS.ErrnoException).code;
  return code === 'ECONNRESET' || code === 'EPIPE' || code === 'ETIMEDOUT';
}

function poolSslOption():
  | boolean
  | { rejectUnauthorized: boolean }
  | undefined {
  const mode = (process.env.DATABASE_SSL ?? '').toLowerCase();
  if (mode === 'false' || mode === 'disable' || mode === 'off') {
    return undefined;
  }
  if (
    mode === 'true' ||
    mode === 'require' ||
    mode === 'prefer' ||
    mode === 'verify-full'
  ) {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== '0',
    };
  }
  return undefined;
}

/**
 * `neon` — Neon serverless driver over WebSockets (best for *.neon.tech).
 * `pg` — node-postgres TCP pool (typical local Docker / RDS).
 * `auto` — pick `neon` when DATABASE_URL host looks like Neon.
 */
function resolvePrismaDriver(connectionString: string): 'neon' | 'pg' {
  const mode = (process.env.DATABASE_PRISMA_DRIVER ?? 'auto').toLowerCase();
  if (mode === 'neon') {
    return 'neon';
  }
  if (mode === 'pg') {
    return 'pg';
  }
  if (/neon\.tech/i.test(connectionString)) {
    return 'neon';
  }
  return 'pg';
}

/**
 * Nest DI token. Instances are created via {@link PrismaService.create}
 * (see PrismaModule `useFactory`); do not `new PrismaService()`.
 */
export class PrismaService extends PrismaClient {
  private constructor(options: Prisma.PrismaClientOptions) {
    super(options);
  }

  static create(): PrismaService {
    const connectionString =
      process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Set DATABASE_URL (and optionally DATABASE_PUBLIC_URL for local dev / Railway proxy) in your .env.',
      );
    }

    const log = new Logger(PrismaService.name);
    const driver = resolvePrismaDriver(connectionString);

    let adapter: Prisma.PrismaClientOptions['adapter'];

    if (driver === 'neon') {
      neonConfig.webSocketConstructor = WebSocket;
      log.log(
        'Prisma: using Neon serverless driver (WebSocket). Set DATABASE_PRISMA_DRIVER=pg to force TCP/pg instead.',
      );
      adapter = new PrismaNeon(
        {
          connectionString,
          max: envInt('DATABASE_NEON_POOL_MAX', 10),
        },
        {
          onPoolError: (err) => log.warn(`Neon pool error: ${err.message}`),
        },
      );
    } else {
      const ssl = poolSslOption();
      const pool = new pg.Pool({
        connectionString,
        max: envInt('DATABASE_POOL_MAX', 10),
        idleTimeoutMillis: envInt('DATABASE_POOL_IDLE_MS', 60_000),
        connectionTimeoutMillis: envInt(
          'DATABASE_POOL_CONN_TIMEOUT_MS',
          30_000,
        ),
        keepAlive: true,
        keepAliveInitialDelayMillis: 3000,
        ...(ssl !== undefined ? { ssl } : {}),
      });

      log.log(
        'Prisma: using node-postgres (TCP pool). For Neon, use a *.neon.tech URL or DATABASE_PRISMA_DRIVER=neon.',
      );

      adapter = new PrismaPg(pool, {
        disposeExternalPool: true,
        onPoolError: (err) => log.warn(`PostgreSQL pool error: ${err.message}`),
      });
    }

    const base = new PrismaClient({ adapter });
    const retries = Math.min(
      8,
      Math.max(1, envInt('DATABASE_QUERY_RETRY_ATTEMPTS', 4)),
    );

    const extended = base.$extends({
      query: {
        async $allOperations({ args, query }) {
          let last: unknown;
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              return await query(args);
            } catch (e) {
              last = e;
              if (!isTransientConnectionError(e) || attempt === retries - 1) {
                throw e;
              }
              await delay(50 * 2 ** attempt);
            }
          }
          throw last;
        },
      },
    });

    return extended as unknown as PrismaService;
  }
}

/** Wires Prisma connect/disconnect into Nest lifecycle (used with PrismaService factory). */
@Injectable()
export class PrismaLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$connect();
    } catch (e) {
      this.log.error(
        `Failed to connect to the database: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
