import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface ClientRequestRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly clients = new Map<string, ClientRequestRecord>();
  private readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private readonly GLOBAL_LIMIT = process.env.RATE_LIMIT_GLOBAL ? parseInt(process.env.RATE_LIMIT_GLOBAL, 10) : 1000;
  private readonly AUTH_LIMIT = process.env.RATE_LIMIT_AUTH ? parseInt(process.env.RATE_LIMIT_AUTH, 10) : 500;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const record = this.clients.get(clientIp) || { timestamps: [] };

    // Clean up timestamps outside current window
    record.timestamps = record.timestamps.filter(
      (time) => now - time < this.WINDOW_MS,
    );

    const isAuthRoute =
      req.path.includes('/auth/login') || req.path.includes('/auth/signup');
    const maxLimit = isAuthRoute ? this.AUTH_LIMIT : this.GLOBAL_LIMIT;

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
