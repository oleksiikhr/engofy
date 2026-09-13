import { Command } from '@nestjs/cqrs';

export class RemoveCardCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly cardId: string,
  ) {
    super();
  }
}
