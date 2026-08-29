import { Command } from '@nestjs/cqrs';

export class RetryPostCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
