import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DomainError } from '../../errors/domain.error.js';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(this.constructor.name);

  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    this.logger.warn({ cause: exception }, exception.message);

    response.status(exception.status).send({
      message: exception.message,
    });
  }
}
