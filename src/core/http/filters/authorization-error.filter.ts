import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthorizationError } from '../../errors/authorization.error.js';

@Catch(AuthorizationError)
export class AuthorizationErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(this.constructor.name);

  catch(exception: AuthorizationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    this.logger.warn({ cause: exception }, exception.message);

    response.status(HttpStatus.FORBIDDEN).send({
      message: exception.message,
    });
  }
}
