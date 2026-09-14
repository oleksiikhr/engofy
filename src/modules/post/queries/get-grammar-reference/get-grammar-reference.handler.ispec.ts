import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { User } from '../../../auth/entities/user.entity.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { Disposition } from '../../../learning/enums/disposition.enum.js';
import { LearningCardState } from '../../../learning/enums/learning-card-state.enum.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostModule } from '../../post.module.js';
import { GetGrammarReferenceQuery } from './get-grammar-reference.query.js';

async function seedUser(
  em: EntityManager,
  cefrLevel: CefrLevel = CefrLevel.A1,
): Promise<User> {
  const user = em.create(User, {
    email: `${uuidv7()}@example.com`,
    cefrLevel,
  });
  await em.flush();
  return user;
}

function seedCategory(
  em: EntityManager,
  name: string,
  sortOrder: number,
  points: CefrLevel[],
): void {
  const category = em.create(GrammarCategory, { name, sortOrder });
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: `${name} construction`,
    slug: `${name.toLowerCase()}-${uuidv7().slice(0, 8)}`,
    sortOrder,
  });
  points.forEach((cefrLevel, i) => {
    em.create(GrammarUsagePoint, {
      constructionId: construction.id,
      cefrLevel,
      guideword: `USE ${i}`,
      canDoStatement: `Can do ${i}.`,
    });
  });
}

describe('GetGrammarReferenceHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('lists categories in sortOrder with the easiest CEFR and usage-point count per construction', async () => {
    const em = suite.orm.em;
    const b = `BETA-${uuidv7().slice(0, 6)}`;
    const a = `ALPHA-${uuidv7().slice(0, 6)}`;
    seedCategory(em, b, 2, [CefrLevel.B2]);
    seedCategory(em, a, 1, [CefrLevel.C1, CefrLevel.A2]);
    await em.flush();
    em.clear();

    const view = await suite.query(new GetGrammarReferenceQuery(null));
    const names = view.categories.map((c) => c.name);
    expect(names.indexOf(a)).toBeLessThan(names.indexOf(b));

    const alpha = view.categories.find((c) => c.name === a);
    expect(alpha?.constructions[0]).toMatchObject({
      cefrLevel: CefrLevel.A2,
      usagePointCount: 2,
    });
  });

  it('drops constructions without a point at the requested CEFR, and categories left empty', async () => {
    const em = suite.orm.em;
    const keep = `KEEP-${uuidv7().slice(0, 6)}`;
    const drop = `DROP-${uuidv7().slice(0, 6)}`;
    seedCategory(em, keep, 1, [CefrLevel.A2, CefrLevel.B1]);
    seedCategory(em, drop, 2, [CefrLevel.C1]);
    await em.flush();
    em.clear();

    const view = await suite.query(new GetGrammarReferenceQuery(CefrLevel.A2));
    const names = view.categories.map((c) => c.name);
    expect(names).toContain(keep);
    expect(names).not.toContain(drop);
  });

  describe('per-user state (grammar-page-redesign зріз 1)', () => {
    async function seedOneConstruction(
      em: EntityManager,
      pointCefrLevels: CefrLevel[],
    ): Promise<{ slug: string; pointIds: string[] }> {
      const name = `STATE-${uuidv7().slice(0, 6)}`;
      const category = em.create(GrammarCategory, { name, sortOrder: 1 });
      const slug = `${name.toLowerCase()}-${uuidv7().slice(0, 8)}`;
      const construction = em.create(GrammarConstruction, {
        categoryId: category.id,
        name: `${name} construction`,
        slug,
        sortOrder: 1,
      });
      const pointIds = pointCefrLevels.map((cefrLevel, i) => {
        const point = em.create(GrammarUsagePoint, {
          constructionId: construction.id,
          cefrLevel,
          guideword: `USE ${i}`,
          canDoStatement: `Can do ${i}.`,
        });
        return point.id;
      });
      await em.flush();
      return { slug, pointIds };
    }

    async function stateOf(
      query: GetGrammarReferenceQuery,
      slug: string,
    ): Promise<string | undefined> {
      const view = await suite.query(query);
      return view.categories
        .flatMap((category) => category.constructions)
        .find((construction) => construction.slug === slug)?.state;
    }

    it('is New for a guest', async () => {
      const { slug } = await seedOneConstruction(suite.orm.em, [CefrLevel.A1]);
      suite.orm.em.clear();

      expect(await stateOf(new GetGrammarReferenceQuery(null), slug)).toBe(
        'new',
      );
    });

    it("collapses to the most-advanced state across a construction's usage points", async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const { slug, pointIds } = await seedOneConstruction(suite.orm.em, [
        CefrLevel.B1,
        CefrLevel.B1,
      ]);

      suite.orm.em.create(LearningCard, {
        userId: user.id,
        grammarUsagePointId: pointIds[0],
        due: DateTime.now(),
        stability: 1,
        difficulty: 1,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: LearningCardState.Learning,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      // One point Learning (active card), the other still New — the
      // construction-level badge shows the most advanced of the two.
      expect(
        await stateOf(new GetGrammarReferenceQuery(null, user.id), slug),
      ).toBe('learning');
    });

    it('is Learned when a below-level CEFR default applies with no card', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B2);
      const { slug } = await seedOneConstruction(suite.orm.em, [CefrLevel.A1]);
      suite.orm.em.clear();

      expect(
        await stateOf(new GetGrammarReferenceQuery(null, user.id), slug),
      ).toBe('learned');
    });

    it('is Skipped when the learner dismissed the only usage point', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const { slug, pointIds } = await seedOneConstruction(suite.orm.em, [
        CefrLevel.C1,
      ]);
      suite.orm.em.create(LearningDisposition, {
        userId: user.id,
        grammarUsagePointId: pointIds[0],
        disposition: Disposition.Skipped,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      expect(
        await stateOf(new GetGrammarReferenceQuery(null, user.id), slug),
      ).toBe('skipped');
    });
  });
});
