import { Command } from '@nestjs/cqrs';
import type { RequestLoginCodeDto } from './request-login-code.dto.js';

export class RequestLoginCodeCommand extends Command<void> {
  constructor(
    readonly dto: RequestLoginCodeDto,
    readonly ip: string,
  ) {
    super();
  }
}
