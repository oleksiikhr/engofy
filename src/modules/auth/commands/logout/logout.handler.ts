import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionService } from '../../services/session.service.js';
import { LogoutCommand } from './logout.command.js';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessions: SessionService) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.sessions.revoke(command.dto.sessionToken);
  }
}
