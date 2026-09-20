import { Command } from '@nestjs/cqrs';

export class EnrichGrammarCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
