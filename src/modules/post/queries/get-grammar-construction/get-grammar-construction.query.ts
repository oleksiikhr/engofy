import { Query } from '@nestjs/cqrs';
import type { GrammarConstructionView } from './grammar-construction-view.js';

export class GetGrammarConstructionQuery extends Query<GrammarConstructionView | null> {
  constructor(
    readonly slug: string,
    // null for a guest (the route is @Public()) — every usage point's
    // `state` is then EffectiveState.New, no LearningCard/Disposition join.
    readonly userId: string | null = null,
  ) {
    super();
  }
}
