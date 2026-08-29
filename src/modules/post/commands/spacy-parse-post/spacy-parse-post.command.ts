import { Command } from '@nestjs/cqrs';

export class SpacyParsePostCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
