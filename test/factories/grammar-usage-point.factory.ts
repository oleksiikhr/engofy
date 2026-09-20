import { Factory } from '@mikro-orm/seeder';
import { GrammarUsagePoint } from '../../src/modules/post/entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../src/modules/post/enums/cefr-level.enum.js';
import { nextSeq } from './sequence.js';

// `constructionId` has no default — pass the construction's id.
export class GrammarUsagePointFactory extends Factory<GrammarUsagePoint> {
  readonly model = GrammarUsagePoint;

  protected definition() {
    const n = nextSeq('grammar-usage-point');

    return {
      cefrLevel: CefrLevel.B1,
      guideword: `USE: POINT ${n}`,
      canDoStatement: `Can use grammar point ${n}.`,
    };
  }
}
