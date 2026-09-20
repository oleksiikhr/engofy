import { Command } from '@nestjs/cqrs';

export class UnmarkPostReadCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly shortId: string,
  ) {
    super();
  }
}
