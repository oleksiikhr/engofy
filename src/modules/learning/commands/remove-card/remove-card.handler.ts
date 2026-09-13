import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import type { DispositionTarget } from '../../domain/disposition-target.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningDisposition } from '../../entities/learning-disposition.entity.js';
import { Disposition } from '../../enums/disposition.enum.js';
import { CardNotFoundError } from '../../errors/card-not-found.error.js';
import { RemoveCardCommand } from './remove-card.command.js';

// Removes a card (learning-foundation §2, the project's first delete):
// `reps === 0` (added but never reviewed) is a physical delete — there is no
// FSRS history worth keeping. `reps > 0` archives it instead (out of the
// practice queue, dictionary, and free-tier cap, but its scheduling state
// survives for `AddCardHandler`'s unarchive path) and records a Known
// disposition, so the effective-state read (once wired) still shows the
// target as learned rather than reverting to New.
@CommandHandler(RemoveCardCommand)
export class RemoveCardHandler implements ICommandHandler<RemoveCardCommand> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId, cardId }: RemoveCardCommand): Promise<void> {
    const card = await this.em.findOne(LearningCard, { id: cardId, userId });
    if (!card) {
      throw new CardNotFoundError();
    }

    if (card.reps === 0) {
      this.em.remove(card);
      return;
    }

    card.archivedAt = DateTime.now();

    const target = toDispositionTarget(card);
    if (target) {
      await this.recordKnown(userId, target);
    }
  }

  private async recordKnown(
    userId: string,
    target: DispositionTarget,
  ): Promise<void> {
    const existing = await this.em.findOne(LearningDisposition, {
      userId,
      ...targetFilter(target),
    });
    if (existing) {
      existing.disposition = Disposition.Known;
      return;
    }

    this.em.create(LearningDisposition, {
      userId,
      wordDefinitionId: target.type === 'wordDefinition' ? target.id : null,
      phraseId: target.type === 'phrase' ? target.id : null,
      grammarUsagePointId: target.type === 'grammar' ? target.id : null,
      disposition: Disposition.Known,
    });
  }
}

// `learning_cards` still keys a word target by `wordId`, not
// `wordDefinitionId` (learning-foundation §3 migrates this) — a word can
// have several definitions/POS senses, so there is no single sense to
// attribute the disposition to yet. Phrase and grammar targets map directly.
function toDispositionTarget(card: LearningCard): DispositionTarget | null {
  if (card.phraseId) {
    return { type: 'phrase', id: card.phraseId };
  }
  if (card.grammarUsagePointId) {
    return { type: 'grammar', id: card.grammarUsagePointId };
  }
  return null;
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
