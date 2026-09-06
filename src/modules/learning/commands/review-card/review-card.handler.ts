import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import type { CardSchedulingState } from '../../domain/fsrs-mapping.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { ReviewLog } from '../../entities/review-log.entity.js';
import { CardNotFoundError } from '../../errors/card-not-found.error.js';
import { FsrsService } from '../../services/fsrs.service.js';
import { SkillProgressService } from '../../services/skill-progress.service.js';
import { type CardView, toCardView } from '../../types/card-view.type.js';
import { ReviewCardCommand } from './review-card.command.js';

// Grades a card (Again/Hard/Good/Easy), reschedules it via ts-fsrs, and
// appends an immutable review_logs row (PLAN.md §3.5). For a grammar card it
// then updates the construction's user_skill_progress row (PLAN.md §3.6).
@CommandHandler(ReviewCardCommand)
export class ReviewCardHandler implements ICommandHandler<ReviewCardCommand> {
  constructor(
    private readonly em: EntityManager,
    private readonly fsrs: FsrsService,
    private readonly skillProgress: SkillProgressService,
  ) {}

  async execute(command: ReviewCardCommand): Promise<CardView> {
    const { userId, cardId, rating } = command;

    const card = await this.em.findOne(LearningCard, { id: cardId, userId });
    if (!card) {
      throw new CardNotFoundError();
    }

    const current: CardSchedulingState = {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.lastReview ?? null,
    };

    const { card: next, log } = this.fsrs.review(
      current,
      rating,
      DateTime.now(),
    );

    card.due = next.due;
    card.stability = next.stability;
    card.difficulty = next.difficulty;
    card.elapsedDays = next.elapsedDays;
    card.scheduledDays = next.scheduledDays;
    card.reps = next.reps;
    card.lapses = next.lapses;
    card.state = next.state;
    card.lastReview = next.lastReview;

    const reviewLog = new ReviewLog();
    reviewLog.cardId = card.id;
    reviewLog.rating = log.rating;
    reviewLog.reviewedAt = log.reviewedAt;
    reviewLog.elapsedDays = log.elapsedDays;
    reviewLog.scheduledDays = log.scheduledDays;
    this.em.persist(reviewLog);

    await this.skillProgress.recordGrammarReview(userId, card, rating);

    return toCardView(card);
  }
}
