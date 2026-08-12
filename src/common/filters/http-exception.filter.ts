import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string; startTime?: number }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let errorType = 'InternalServerError';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resObj = exceptionResponse as Record<string, unknown>;
      message = (resObj.message as string | string[]) || message;
      const ctorName = exception && typeof exception === 'object' && 'constructor' in exception
        ? (exception.constructor as { name?: string }).name
        : undefined;
      errorType = (resObj.error as string) || ctorName || 'HttpException';
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name;
    }

    const requestId = request.correlationId || request.headers['x-request-id'] || 'N/A';
    const duration = request.startTime ? Date.now() - request.startTime : 0;

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} HTTP ${status} (${duration}ms) - ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} HTTP ${status} (${duration}ms) - ${Array.isArray(message) ? message.join(', ') : message}`,
      );
    }

    // Collect any extra fields from the exception response (e.g. suggestedNextAvailable)
    let extraFields: Record<string, unknown> = {};
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resObj = exceptionResponse as Record<string, unknown>;
      const { message: _m, error: _e, statusCode: _s, ...rest } = resObj;
      extraFields = rest;
    }

    response.status(status).json({
      statusCode: status,
      error: errorType,
      message,
      ...extraFields,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
