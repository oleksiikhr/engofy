import { Query } from '@nestjs/cqrs';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { GrammarGroupBy } from '../../enums/grammar-group-by.enum.js';
import type { GrammarReferenceView } from './grammar-reference-view.js';

export interface GetGrammarReferenceOptions {
  // When non-empty, only constructions with at least one usage point at any
  // of these levels are kept, and groups left with none are dropped.
  cefrLevels: CefrLevel[];
  groupBy: GrammarGroupBy;
}

export class GetGrammarReferenceQuery extends Query<GrammarReferenceView> {
  constructor(
    readonly options: GetGrammarReferenceOptions,
    // null for a guest (the route is @Public()) — every construction's
    // `state` is then EffectiveState.New, no LearningCard/Disposition join.
    readonly userId: string | null = null,
  ) {
    super();
  }
}
