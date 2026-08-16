import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionService } from '../../services/session.service.js';
import {
  type ResolvedSession,
  ResolveSessionCommand,
} from './resolve-session.command.js';

// TODO Add tests
@CommandHandler(ResolveSessionCommand)
export class ResolveSessionHandler
  implements ICommandHandler<ResolveSessionCommand>
{
  constructor(private readonly sessions: SessionService) {}

  async execute({
    dto,
  }: ResolveSessionCommand): Promise<ResolvedSession | null> {
    const userId = await this.sessions.resolveUserId(dto.token);
    if (!userId) {
      return null;
    }

    this.sessions.refresh(dto.token).catch(() => undefined);

    return { userId };
  }
}
