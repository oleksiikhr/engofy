import { Factory } from '@mikro-orm/seeder';
import { GrammarCategory } from '../../src/modules/post/entities/grammar-category.entity.js';
import { nextSeq } from './sequence.js';

export class GrammarCategoryFactory extends Factory<GrammarCategory> {
  readonly model = GrammarCategory;

  protected definition() {
    const n = nextSeq('grammar-category');

    return { name: `Category ${n}`, sortOrder: n };
  }
}
