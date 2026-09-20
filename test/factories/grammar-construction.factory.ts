import { Factory } from '@mikro-orm/seeder';
import { GrammarConstruction } from '../../src/modules/post/entities/grammar-construction.entity.js';
import { nextSeq } from './sequence.js';

// `categoryId` has no default — pass the category's id.
export class GrammarConstructionFactory extends Factory<GrammarConstruction> {
  readonly model = GrammarConstruction;

  protected definition() {
    const n = nextSeq('grammar-construction');

    return {
      name: `Construction ${n}`,
      slug: `construction-${n}`,
      sortOrder: n,
    };
  }
}
