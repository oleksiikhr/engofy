import { Factory } from '@mikro-orm/seeder';
import { GrammarMatch } from '../../src/modules/post/entities/grammar-match.entity.js';

// `sentenceId` and `grammarUsagePointId` have no default — pass the parents' ids.
export class GrammarMatchFactory extends Factory<GrammarMatch> {
  readonly model = GrammarMatch;

  protected definition() {
    return { tokenStart: 0, tokenEnd: 1 };
  }
}
