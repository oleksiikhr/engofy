import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AddCardCommand } from './commands/add-card/add-card.command.js';
import { ReviewCardCommand } from './commands/review-card/review-card.command.js';
import type { CardTargetInput } from './domain/card-target.js';
import type { ReviewRating } from './enums/review-rating.enum.js';
import type { DictionaryView } from './queries/get-dictionary/dictionary-view.js';
import { GetDictionaryQuery } from './queries/get-dictionary/get-dictionary.query.js';
import { GetPracticeQueueQuery } from './queries/get-practice-queue/get-practice-queue.query.js';
import type { PracticeQueueItem } from './queries/get-practice-queue/practice-queue-item.js';
import { GetProfileQuery } from './queries/get-profile/get-profile.query.js';
import type { ProfileView } from './queries/get-profile/profile-view.js';
import type { CardView } from './types/card-view.type.js';

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

  getPracticeQueue(
    userId: string,
    limit: number,
  ): Promise<PracticeQueueItem[]> {
    return this.queryBus.execute(new GetPracticeQueueQuery(userId, limit));
  }

  getProfile(userId: string): Promise<ProfileView> {
    return this.queryBus.execute(new GetProfileQuery(userId));
  }

  getDictionary(userId: string): Promise<DictionaryView> {
    return this.queryBus.execute(new GetDictionaryQuery(userId));
  }
}
