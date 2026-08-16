import { Command } from '@nestjs/cqrs';
import type { LogoutDto } from './logout.dto.js';

export class LogoutCommand extends Command<void> {
  constructor(readonly dto: LogoutDto) {
    super();
  }
}
