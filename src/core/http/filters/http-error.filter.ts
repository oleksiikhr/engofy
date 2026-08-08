import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(this.constructor.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (status >= 500) {
      this.logger.error({ cause: exception }, exception.message);

      Sentry.captureException(exception);
    } else {
      this.logger.warn({ cause: exception }, exception.message);
    }

    const payload =
      status >= 500
        ? { message: 'Internal server error' }
        : typeof exceptionResponse === 'object'
          ? exceptionResponse
          : { message: exceptionResponse };

    response.status(status).send(payload);
  }
}
