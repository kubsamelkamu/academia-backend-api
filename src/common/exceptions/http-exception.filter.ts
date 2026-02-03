import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof raw === 'string'
        ? raw
        : (raw as any)?.message
          ? (raw as any).message
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    const errorCode =
      exception instanceof HttpException
        ? (exception as any).name
          ? String((exception as any).name)
              .replace(/Exception$/, '')
              .toUpperCase()
          : 'HTTP_EXCEPTION'
        : 'INTERNAL_SERVER_ERROR';

    response.status(status).json({
      success: false,
      message,
      error: {
        code: errorCode,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
