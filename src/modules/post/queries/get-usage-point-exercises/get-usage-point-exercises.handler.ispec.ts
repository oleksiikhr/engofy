import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { nextSeq } from '../../../../../test/factories/sequence.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { ExerciseType } from '../../enums/exercise-type.enum.js';
import { PostModule } from '../../post.module.js';
import { GetUsagePointExercisesQuery } from './get-usage-point-exercises.query.js';

function seedUsagePoint(em: EntityManager): string {
  const n = nextSeq('usage-point-exercises-test');
  const category = factories(em).grammarCategory.makeOne({
    name: `TENSES-${n}`,
  });
  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    slug: `present-perfect-${n}`,
  });
  return factories(em).grammarUsagePoint.makeOne({
    constructionId: construction.id,
  }).id;
}

describe('GetUsagePointExercisesHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns no items for a usage point with no seeded exercises yet', async () => {
    const usagePointId = seedUsagePoint(suite.orm.em);
    await suite.orm.em.flush();

    const view = await suite.query(
      new GetUsagePointExercisesQuery(usagePointId),
    );

    expect(view.items).toEqual([]);
  });

  it('returns only the pool for the given usage point, oldest first', async () => {
    const em = suite.orm.em;
    const usagePointId = seedUsagePoint(em);
    const otherUsagePointId = seedUsagePoint(em);

    const first = factories(em).grammarUsagePointExercise.makeOne({
      usagePointId,
      type: ExerciseType.FillBlank,
      payload: { prompt: 'I ___ to work.', answer: 'go' },
    });
    const second = factories(em).grammarUsagePointExercise.makeOne({
      usagePointId,
      type: ExerciseType.MultipleChoice,
      payload: { prompt: 'She ___ to work.', options: ['go', 'goes'] },
    });
    factories(em).grammarUsagePointExercise.makeOne({
      usagePointId: otherUsagePointId,
      type: ExerciseType.FillBlank,
      payload: { prompt: 'unrelated', answer: 'unrelated' },
    });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetUsagePointExercisesQuery(usagePointId),
    );

    expect(view.items).toEqual([
      {
        id: first.id,
        type: ExerciseType.FillBlank,
        payload: { prompt: 'I ___ to work.', answer: 'go' },
      },
      {
        id: second.id,
        type: ExerciseType.MultipleChoice,
        payload: { prompt: 'She ___ to work.', options: ['go', 'goes'] },
      },
    ]);
  });
});
