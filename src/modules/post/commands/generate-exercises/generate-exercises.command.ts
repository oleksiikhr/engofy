import { Command } from '@nestjs/cqrs';

export class GenerateExercisesCommand extends Command<void> {
  constructor(readonly postId: string) {
    super();
  }
}
