import { Query } from '@nestjs/cqrs';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { GrammarReferenceView } from './grammar-reference-view.js';

export class GetGrammarReferenceQuery extends Query<GrammarReferenceView> {
  constructor(
    // When set, only constructions with at least one usage point at this
    // level are kept, and categories left with none are dropped.
    readonly cefr: CefrLevel | null,
    // null for a guest (the route is @Public()) — every construction's
    // `state` is then EffectiveState.New, no LearningCard/Disposition join.
    readonly userId: string | null = null,
  ) {
    super();
  }
}
