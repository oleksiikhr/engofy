import { Command } from '@nestjs/cqrs';

export class MarkPostReadCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly shortId: string,
  ) {
    super();
  }
}
