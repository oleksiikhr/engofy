import { Command } from '@nestjs/cqrs';
import type { CardTargetInput } from '../../domain/card-target.js';
import type { CardView } from '../../types/card-view.type.js';

export class AddCardCommand extends Command<CardView> {
  constructor(
    readonly userId: string,
    readonly target: CardTargetInput,
  ) {
    super();
  }
}
