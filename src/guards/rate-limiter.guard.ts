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
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly clients = new Map<string, ClientRequestRecord>();
  private readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private readonly GLOBAL_LIMIT = process.env.RATE_LIMIT_GLOBAL ? parseInt(process.env.RATE_LIMIT_GLOBAL, 10) : 1000;
  private readonly AUTH_LIMIT = process.env.RATE_LIMIT_AUTH ? parseInt(process.env.RATE_LIMIT_AUTH, 10) : 500;
  private redisClient: any = null;
  private isRedisConnected = false;

  constructor() {
    this.initRedisIfConfigured();
  }

  private async initRedisIfConfigured() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (redisUrl) {
      try {
        // Dynamic import of ioredis if installed
        const Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl, {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        this.redisClient.on('connect', () => {
          this.isRedisConnected = true;
          this.logger.log('Distributed Redis Rate Limiter initialized successfully.');
        });
        this.redisClient.on('error', (err: any) => {
          this.isRedisConnected = false;
          this.logger.warn(`Redis connection error, falling back to in-memory limiter: ${err.message}`);
        });
      } catch {
        this.logger.log('Redis package not found or unconfigured. Operating in single-instance in-memory rate limiting mode.');
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
        const currentRequests = await this.redisClient.incr(key);
        if (currentRequests === 1) {
          await this.redisClient.expire(key, 60);
        }
        if (currentRequests > maxLimit) {
          throw new HttpException(
            'Too Many Requests — Distributed Rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        return true;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        this.logger.warn(`Redis command failed, falling back to in-memory mode: ${err.message}`);
      }
    }

    // 2. In-Memory Sliding-Window Fallback Mode (Single-Instance Safe)
    const now = Date.now();
    const record = this.clients.get(clientIp) || { timestamps: [] };

    // Clean up timestamps outside current window
    record.timestamps = record.timestamps.filter(
      (time) => now - time < this.WINDOW_MS,
    );

    if (record.timestamps.length >= maxLimit) {
      throw new HttpException(
        'Too Many Requests — Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.timestamps.push(now);
    this.clients.set(clientIp, record);
    return true;
  }
}

