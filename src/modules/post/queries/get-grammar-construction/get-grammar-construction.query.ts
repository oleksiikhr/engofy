import { Query } from '@nestjs/cqrs';
import type { GrammarConstructionView } from './grammar-construction-view.js';

export class GetGrammarConstructionQuery extends Query<GrammarConstructionView | null> {
  constructor(readonly slug: string) {
    super();
  }
}
