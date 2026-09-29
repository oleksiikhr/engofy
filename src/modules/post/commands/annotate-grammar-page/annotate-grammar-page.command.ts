import { Command } from '@nestjs/cqrs';

export interface AnnotatedGrammarPageView {
  blocks: number;
  parsed: number;
  removed: number;
}

export class AnnotateGrammarPageCommand extends Command<AnnotatedGrammarPageView> {
  // `blocks`: the text blocks of the construction's handcrafted page, as the
  // web extracts them.
  constructor(
    readonly slug: string,
    readonly blocks: string[],
  ) {
    super();
  }
}
