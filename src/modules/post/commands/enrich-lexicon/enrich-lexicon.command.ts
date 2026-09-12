import { Command } from '@nestjs/cqrs';

export class EnrichLexiconCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
