import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'crypto';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
  startTime?: number;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction) {
    const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const correlationId = (Array.isArray(existingId) ? existingId[0] : existingId) || uuidv4();

    req.correlationId = correlationId;
    req.startTime = Date.now();

    res.setHeader('x-request-id', correlationId);
    next();
  }
}
