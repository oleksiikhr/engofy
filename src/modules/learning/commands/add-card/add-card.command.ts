import { Command } from '@nestjs/cqrs';
import type { CardTargetInput } from '../../domain/card-target.js';
import type { LearningCard } from '../../entities/learning-card.entity.js';

export class AddCardCommand extends Command<LearningCard> {
  constructor(
    readonly userId: string,
    readonly target: CardTargetInput,
  ) {
    super();
  }
}
