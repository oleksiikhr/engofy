import { Command } from '@nestjs/cqrs';

export class TagGrammarCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
