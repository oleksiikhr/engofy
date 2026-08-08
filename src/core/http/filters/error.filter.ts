import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    this.logger.error({ cause: exception }, 'Unhandled exception');

    Sentry.captureException(exception);

    // Route the response through the adapter rather than calling `response.status()`
    // directly — some failure paths (e.g. a request aborted before Fastify's Reply
    // wrapper is attached) hand back the raw Node response, which has no `.status()`.
    httpAdapter.reply(
      ctx.getResponse(),
      { message: 'Internal server error' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
