import { Command } from '@nestjs/cqrs';

export interface AnnotatedGrammarPageView {
  blocks: number;
  parsed: number;
  removed: number;
}

export class AnnotateGrammarPageCommand extends Command<AnnotatedGrammarPageView> {
  // `blocks`: the text blocks of the construction's handcrafted page, as the
  // web extracts them. `refresh` re-parses every block, not only new ones
  // (after the word rule itself changed).
  constructor(
    readonly slug: string,
    readonly blocks: string[],
    readonly refresh = false,
  ) {
    super();
  }
}
