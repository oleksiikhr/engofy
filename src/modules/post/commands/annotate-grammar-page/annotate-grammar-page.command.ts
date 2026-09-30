import { Command } from '@nestjs/cqrs';
import type { LexBlockInput, LexBlockPhrases } from '../../domain/lex-block.js';

export interface AnnotatedGrammarPageView {
  blocks: number;
  parsed: number;
  removed: number;
}

export class AnnotateGrammarPageCommand extends Command<AnnotatedGrammarPageView> {
  // `blocks`: the text blocks of the construction's handcrafted page, as the
  // web extracts them, with the target ranges its `<mark>`s cover. `phrases`: the hand-listed phrases to link (see
  // LexBlockPhrases). `refresh` re-parses every block, not only new ones
  // (after the word rule or the phrase list changed).
  constructor(
    readonly slug: string,
    readonly blocks: LexBlockInput[],
    readonly phrases: LexBlockPhrases = { literal: [], phrasalVerbs: [] },
    readonly refresh = false,
  ) {
    super();
  }
}
