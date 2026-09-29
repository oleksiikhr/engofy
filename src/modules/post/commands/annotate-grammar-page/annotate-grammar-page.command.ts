import { Command } from '@nestjs/cqrs';
import type { LexBlockPhrases } from '../../domain/lex-block.js';

export interface AnnotatedGrammarPageView {
  blocks: number;
  parsed: number;
  removed: number;
}

export class AnnotateGrammarPageCommand extends Command<AnnotatedGrammarPageView> {
  // `blocks`: the text blocks of the construction's handcrafted page, as the
  // web extracts them. `phrases`: the hand-listed phrases to link (see
  // LexBlockPhrases). `refresh` re-parses every block, not only new ones
  // (after the word rule or the phrase list changed).
  constructor(
    readonly slug: string,
    readonly blocks: string[],
    readonly phrases: LexBlockPhrases = { literal: [], phrasalVerbs: [] },
    readonly refresh = false,
  ) {
    super();
  }
}
