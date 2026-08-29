import { Command } from '@nestjs/cqrs';

export class AssessComplexityCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
