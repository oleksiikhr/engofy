import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../../post/entities/phrase.entity.js';
import { Word } from '../../../post/entities/word.entity.js';
import {
  type CardTarget,
  resolveCardTarget,
} from '../../domain/card-target.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { InvalidCardTargetError } from '../../errors/invalid-card-target.error.js';
import { CardLimitService } from '../../services/card-limit.service.js';
import { FsrsService } from '../../services/fsrs.service.js';
import { AddCardCommand } from './add-card.command.js';

// Adds one SRS card for the current user (PLAN.md §3.5). Idempotent: a second
// add for the same target returns the existing card rather than erroring, so
// the "+" button is safe to double-tap. The free-tier cap is only checked
// when a genuinely new card would be created.
@CommandHandler(AddCardCommand)
export class AddCardHandler implements ICommandHandler<AddCardCommand> {
  constructor(
    private readonly em: EntityManager,
    private readonly cardLimit: CardLimitService,
    private readonly fsrs: FsrsService,
  ) {}

  async execute(command: AddCardCommand): Promise<LearningCard> {
    const { userId } = command;
    const target = resolveCardTarget(command.target);

    await this.assertTargetExists(target);

    const existing = await this.em.findOne(LearningCard, {
      userId,
      ...targetFilter(target),
    });
    if (existing) {
      return existing;
    }

    await this.cardLimit.assertCanAddCard(userId);

    const scheduling = this.fsrs.newCard(DateTime.now());
    const card = new LearningCard();
    card.userId = userId;
    card.wordId = target.type === 'word' ? target.id : null;
    card.phraseId = target.type === 'phrase' ? target.id : null;
    card.grammarUsagePointId = target.type === 'grammar' ? target.id : null;
    card.due = scheduling.due;
    card.stability = scheduling.stability;
    card.difficulty = scheduling.difficulty;
    card.elapsedDays = scheduling.elapsedDays;
    card.scheduledDays = scheduling.scheduledDays;
    card.reps = scheduling.reps;
    card.lapses = scheduling.lapses;
    card.state = scheduling.state;
    card.lastReview = scheduling.lastReview;
    this.em.persist(card);

    return card;
  }

  private async assertTargetExists(target: CardTarget): Promise<void> {
    const found = await this.findTarget(target);
    if (!found) {
      throw new InvalidCardTargetError(
        `No ${target.type} exists with id ${target.id}.`,
      );
    }
  }

  private findTarget(target: CardTarget): Promise<object | null> {
    switch (target.type) {
      case 'word':
        return this.em.findOne(Word, { id: target.id });
      case 'phrase':
        return this.em.findOne(Phrase, { id: target.id });
      default:
        return this.em.findOne(GrammarUsagePoint, { id: target.id });
    }
  }
}

function targetFilter(target: CardTarget): Record<string, string> {
  switch (target.type) {
    case 'word':
      return { wordId: target.id };
    case 'phrase':
      return { phraseId: target.id };
    default:
      return { grammarUsagePointId: target.id };
  }
}
