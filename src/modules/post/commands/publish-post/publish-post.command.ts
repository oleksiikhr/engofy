import { Command } from '@nestjs/cqrs';

export class PublishPostCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
