import { Command } from '@nestjs/cqrs';

export class AnnotatePostCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
