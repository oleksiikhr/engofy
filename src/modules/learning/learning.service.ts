import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AddCardCommand } from './commands/add-card/add-card.command.js';
import { ReviewCardCommand } from './commands/review-card/review-card.command.js';
import type { CardTargetInput } from './domain/card-target.js';
import type { LearningCard } from './entities/learning-card.entity.js';
import type { ReviewRating } from './enums/review-rating.enum.js';
import { GetPracticeQueueQuery } from './queries/get-practice-queue/get-practice-queue.query.js';
import type { PracticeQueueItem } from './queries/get-practice-queue/practice-queue-item.js';
import { GetProfileQuery } from './queries/get-profile/get-profile.query.js';
import type { ProfileView } from './queries/get-profile/profile-view.js';

@Injectable()
export class LearningService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async addCard(
    userId: string,
    target: CardTargetInput,
  ): Promise<LearningCard> {
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
  ): Promise<LearningCard> {
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
}
