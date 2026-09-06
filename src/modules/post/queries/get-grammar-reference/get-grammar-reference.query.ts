import { Query } from '@nestjs/cqrs';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { GrammarReferenceView } from './grammar-reference-view.js';

export class GetGrammarReferenceQuery extends Query<GrammarReferenceView> {
  constructor(
    // When set, only constructions with at least one usage point at this
    // level are kept, and categories left with none are dropped.
    readonly cefr: CefrLevel | null,
  ) {
    super();
  }
}
