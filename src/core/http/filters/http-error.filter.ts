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

    if (status >= 500) {
      this.logger.error({ cause: exception }, exception.message);

      Sentry.captureException(exception);
    } else {
      this.logger.warn({ cause: exception }, exception.message);
    }

    // Every error body this app emits is `{ message: string }` (matches
    // `DomainErrorFilter` / `zodValidationExceptionFactory`); don't leak Nest's
    // `{ statusCode, message, error }` shape for guard 401s / `NotFoundException`.
    const message =
      status >= 500 ? 'Internal server error' : extractMessage(exception);

    response.status(status).send({ message });
  }
}

function extractMessage(exception: HttpException): string {
  const res = exception.getResponse();

  if (typeof res === 'string') {
    return res;
  }

  const raw = (res as { message?: unknown }).message;
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && raw.every((m) => typeof m === 'string')) {
    return raw.join(', ');
  }

  return exception.message;
}
