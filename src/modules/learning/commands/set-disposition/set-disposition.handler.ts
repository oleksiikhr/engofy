import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { WordDefinition } from '../../../post/entities/word-definition.entity.js';
import {
  type DispositionTarget,
  resolveDispositionTarget,
} from '../../domain/disposition-target.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { InvalidCardTargetError } from '../../errors/invalid-card-target.error.js';
import {
  type DispositionView,
  toDispositionView,
} from '../../types/disposition-view.type.js';
import { SetDispositionCommand } from './set-disposition.command.js';

// Records a direct known/skipped call on a target with no active card — the
// "I already know this" control (learning-foundation §2). Idempotent: a
// second call for the same target overwrites the stored value rather than
// erroring, so switching a mind from Known to Skipped (or back) is a plain
// re-post.
@CommandHandler(SetDispositionCommand)
export class SetDispositionHandler
  implements ICommandHandler<SetDispositionCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute(command: SetDispositionCommand): Promise<DispositionView> {
    const { userId, disposition } = command;
    const target = resolveDispositionTarget(command.target);

    await this.assertTargetExists(target);

    const existing = await this.em.findOne(LearningDisposition, {
      userId,
      ...targetFilter(target),
    });
    if (existing) {
      existing.disposition = disposition;
      return toDispositionView(existing);
    }

    const row = this.em.create(LearningDisposition, {
      userId,
      wordDefinitionId: target.type === 'wordDefinition' ? target.id : null,
      phraseId: target.type === 'phrase' ? target.id : null,
      grammarUsagePointId: target.type === 'grammar' ? target.id : null,
      disposition,
    });

    return toDispositionView(row);
  }

  private async assertTargetExists(target: DispositionTarget): Promise<void> {
    const found = await this.findTarget(target);
    if (!found) {
      throw new InvalidCardTargetError(
        `No ${target.type} exists with id ${target.id}.`,
      );
    }
  }

  private findTarget(target: DispositionTarget): Promise<object | null> {
    switch (target.type) {
      case 'wordDefinition':
        return this.em.findOne(WordDefinition, { id: target.id });
      case 'phrase':
        return this.em.findOne(Phrase, { id: target.id });
      default:
        return this.em.findOne(GrammarUsagePoint, { id: target.id });
    }
  }
}

function targetFilter(target: DispositionTarget): Record<string, string> {
  switch (target.type) {
    case 'wordDefinition':
      return { wordDefinitionId: target.id };
    case 'phrase':
      return { phraseId: target.id };
    default:
      return { grammarUsagePointId: target.id };
  }
}
