import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionService } from '../../services/session.service.js';
import {
  type ResolvedSession,
  ResolveSessionCommand,
} from './resolve-session.command.js';

@CommandHandler(ResolveSessionCommand)
export class ResolveSessionHandler
  implements ICommandHandler<ResolveSessionCommand>
{
  constructor(private readonly sessions: SessionService) {}

  async execute({
    dto,
  }: ResolveSessionCommand): Promise<ResolvedSession | null> {
    const userId = await this.sessions.resolveUserId(dto.sessionToken);
    if (!userId) {
      return null;
    }

    await this.sessions.refresh(dto.sessionToken);

    return { userId };
  }
}
