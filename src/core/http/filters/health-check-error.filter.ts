import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch(ServiceUnavailableException)
export class HealthCheckErrorFilter implements ExceptionFilter {
  catch(exception: ServiceUnavailableException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(exception.getStatus()).send(exception.getResponse());
  }
}
