import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

interface ClientRequestRecord {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Rate limiter guard with:
 * - Sliding-window in-memory fallback (single-instance safe)
 * - Optional Redis-backed distributed mode (via REDIS_URL env var + ioredis)
 * - Periodic eviction of stale in-memory records (prevents unbounded Map growth)
 * - Configurable limits via RATE_LIMIT_GLOBAL and RATE_LIMIT_AUTH env vars
 */
@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly clients = new Map<string, ClientRequestRecord>();
  private readonly WINDOW_MS = 60 * 1000; // 1-minute sliding window
  private readonly GLOBAL_LIMIT = process.env.RATE_LIMIT_GLOBAL
    ? parseInt(process.env.RATE_LIMIT_GLOBAL, 10)
    : 1000;
  private readonly AUTH_LIMIT = process.env.RATE_LIMIT_AUTH
    ? parseInt(process.env.RATE_LIMIT_AUTH, 10)
    : 500;

  /** Maximum number of unique IPs tracked in memory before eviction */
  private readonly MAX_CLIENTS = 10_000;

  private redisClient: any = null;
  private isRedisConnected = false;

  private evictionInterval: NodeJS.Timeout;

  constructor() {
    this.initRedisIfConfigured();
    // Schedule periodic eviction of stale records every 2 minutes
    this.evictionInterval = setInterval(
      () => this.evictStaleClients(),
      2 * 60 * 1000,
    );

    // Unref so the timer doesn't prevent process exit in tests
    if (this.evictionInterval.unref) {
      this.evictionInterval.unref();
    }
  }

  private evictStaleClients(): void {
    const staleThreshold = Date.now() - this.WINDOW_MS * 2;
    for (const [ip, record] of this.clients) {
      if (record.lastSeen < staleThreshold) {
        this.clients.delete(ip);
      }
    }
  }

  private initRedisIfConfigured(): void {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (redisUrl) {
      try {
        // Dynamic require of ioredis if installed; falls back gracefully if not present
        /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
        const Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl, {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        if (this.redisClient) {
          this.redisClient.on('connect', () => {
            this.isRedisConnected = true;
            this.logger.log(
              'Distributed Redis Rate Limiter initialized successfully.',
            );
          });
          this.redisClient.on('error', (err: { message?: string }) => {
            this.isRedisConnected = false;
            this.logger.warn(
              `Redis connection error, falling back to in-memory limiter: ${err?.message || 'unknown error'}`,
            );
          });
        }
        /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      } catch {
        this.logger.log(
          'Redis package not found or unconfigured. Operating in single-instance in-memory rate limiting mode.',
        );
      }
    }
  }

  public getStorageMode(): 'redis' | 'memory' {
    return this.isRedisConnected ? 'redis' : 'memory';
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const isAuthRoute =
      req.path.includes('/auth/login') || req.path.includes('/auth/signup');
    const maxLimit = isAuthRoute ? this.AUTH_LIMIT : this.GLOBAL_LIMIT;

    // 1. Try Distributed Redis Throttling if connected
    if (this.isRedisConnected && this.redisClient) {
      try {
        const key = `ratelimit:${isAuthRoute ? 'auth' : 'global'}:${clientIp}`;
        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        const currentRequests = Number(await this.redisClient.incr(key));
        if (currentRequests === 1) {
          await this.redisClient.expire(key, 60);
        }
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        if (currentRequests > maxLimit) {
          throw new HttpException(
            'Too Many Requests - Distributed Rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        return true;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Redis command failed, falling back to in-memory mode: ${errorMessage}`,
        );
      }
    }

    // 2. In-Memory Sliding-Window Fallback Mode (Single-Instance Safe)
    const now = Date.now();
    const record = this.clients.get(clientIp) ?? {
      timestamps: [],
      lastSeen: now,
    };

    // Slide the window: remove timestamps outside the current window
    record.timestamps = record.timestamps.filter(
      (time) => now - time < this.WINDOW_MS,
    );
    record.lastSeen = now;

    if (record.timestamps.length >= maxLimit) {
      this.clients.set(clientIp, record);
      throw new HttpException(
        'Too Many Requests - Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.timestamps.push(now);

    // If the Map has grown beyond the cap, evict the oldest-seen entry to prevent
    // unbounded memory growth (e.g. from IP spoofing or a large unique-IP burst).
    if (this.clients.size >= this.MAX_CLIENTS && !this.clients.has(clientIp)) {
      const oldestKey = Array.from(this.clients.keys())[0];
      if (oldestKey) {
        this.clients.delete(oldestKey);
      }
    }

    this.clients.set(clientIp, record);
    return true;
  }
}
