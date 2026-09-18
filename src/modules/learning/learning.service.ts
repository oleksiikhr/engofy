import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AddCardCommand } from './commands/add-card/add-card.command.js';
import { RemoveCardCommand } from './commands/remove-card/remove-card.command.js';
import { ReviewCardCommand } from './commands/review-card/review-card.command.js';
import { SetDispositionCommand } from './commands/set-disposition/set-disposition.command.js';
import type { CardTargetInput } from './domain/card-target.js';
import type { DispositionTargetInput } from './domain/disposition-target.js';
import type { Disposition } from './enums/disposition.enum.js';
import type { ReviewRating } from './enums/review-rating.enum.js';
import type { DictionaryView } from './queries/get-dictionary/dictionary-view.js';
import type { GetDictionaryOptions } from './queries/get-dictionary/get-dictionary.query.js';
import { GetDictionaryQuery } from './queries/get-dictionary/get-dictionary.query.js';
import { GetDueCardCountQuery } from './queries/get-due-card-count/get-due-card-count.query.js';
import { GetPracticeQueueQuery } from './queries/get-practice-queue/get-practice-queue.query.js';
import type { PracticeQueueItem } from './queries/get-practice-queue/practice-queue-item.js';
import { GetProfileQuery } from './queries/get-profile/get-profile.query.js';
import type { ProfileView } from './queries/get-profile/profile-view.js';
import { GetStreakQuery } from './queries/get-streak/get-streak.query.js';
import { GetWordDictionaryDetailQuery } from './queries/get-word-dictionary-detail/get-word-dictionary-detail.query.js';
import type { WordDictionaryDetailView } from './queries/get-word-dictionary-detail/word-dictionary-detail-view.js';
import type { CardView } from './types/card-view.type.js';
import type { DispositionView } from './types/disposition-view.type.js';

@Injectable()
export class LearningService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async addCard(userId: string, target: CardTargetInput): Promise<CardView> {
    const card = await this.commandBus.execute(
      new AddCardCommand(userId, target),
    );

    await this.em.flush();

    return card;
  }

  async reviewCard(
    userId: string,
    cardId: string,
    rating: ReviewRating,
  ): Promise<CardView> {
    const card = await this.commandBus.execute(
      new ReviewCardCommand(userId, cardId, rating),
    );

    await this.em.flush();

    return card;
  }

  async removeCard(userId: string, cardId: string): Promise<void> {
    await this.commandBus.execute(new RemoveCardCommand(userId, cardId));

    await this.em.flush();
  }

  async setDisposition(
    userId: string,
    target: DispositionTargetInput,
    disposition: Disposition,
  ): Promise<DispositionView> {
    const view = await this.commandBus.execute(
      new SetDispositionCommand(userId, target, disposition),
    );

    await this.em.flush();

    return view;
  }

  getPracticeQueue(
    userId: string,
    limit: number,
  ): Promise<PracticeQueueItem[]> {
    return this.queryBus.execute(new GetPracticeQueueQuery(userId, limit));
  }

  getProfile(userId: string): Promise<ProfileView> {
    return this.queryBus.execute(new GetProfileQuery(userId));
  }

  getDictionary(
    userId: string,
    options: GetDictionaryOptions,
  ): Promise<DictionaryView> {
    return this.queryBus.execute(new GetDictionaryQuery(userId, options));
  }

  getWordDictionaryDetail(
    lemma: string,
    userId: string,
  ): Promise<WordDictionaryDetailView | null> {
    return this.queryBus.execute(
      new GetWordDictionaryDetailQuery(lemma, userId),
    );
  }

  getDueCardCount(userId: string): Promise<number> {
    return this.queryBus.execute(new GetDueCardCountQuery(userId));
  }

  getStreak(userId: string): Promise<number> {
    return this.queryBus.execute(new GetStreakQuery(userId));
  }
}
