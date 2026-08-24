import { Command } from '@nestjs/cqrs';

export class AnnotateContentCommand extends Command<void> {
  constructor(readonly contentId: string) {
    super();
  }
}
