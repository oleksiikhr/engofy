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
import { GrammarGroupBy } from '../../enums/grammar-group-by.enum.js';
import { PostModule } from '../../post.module.js';
import { GetGrammarReferenceQuery } from './get-grammar-reference.query.js';

const BY_CATEGORY = { cefrLevels: [], groupBy: GrammarGroupBy.Category };

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

    const view = await suite.query(new GetGrammarReferenceQuery(BY_CATEGORY));
    const names = view.groups.map((c) => c.name);
    expect(names.indexOf(a)).toBeLessThan(names.indexOf(b));

    const alpha = view.groups.find((c) => c.name === a);
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

    const view = await suite.query(
      new GetGrammarReferenceQuery({
        ...BY_CATEGORY,
        cefrLevels: [CefrLevel.A2],
      }),
    );
    const names = view.groups.map((c) => c.name);
    expect(names).toContain(keep);
    expect(names).not.toContain(drop);
  });

  it('keeps constructions matching any of several CEFR levels', async () => {
    const em = suite.orm.em;
    const a2 = `TWOA-${uuidv7().slice(0, 6)}`;
    const b1 = `ONEB-${uuidv7().slice(0, 6)}`;
    const c2 = `TOPC-${uuidv7().slice(0, 6)}`;
    seedCategory(em, a2, 1, [CefrLevel.A2]);
    seedCategory(em, b1, 2, [CefrLevel.B1]);
    seedCategory(em, c2, 3, [CefrLevel.C2]);
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetGrammarReferenceQuery({
        ...BY_CATEGORY,
        cefrLevels: [CefrLevel.A2, CefrLevel.B1],
      }),
    );
    const names = view.groups.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining([a2, b1]));
    expect(names).not.toContain(c2);
  });

  it('groups the same set by CEFR level and by time block', async () => {
    const em = suite.orm.em;
    const other = `MODAL-${uuidv7().slice(0, 6)}`;
    seedCategory(em, other, 1, [CefrLevel.B2, CefrLevel.C1]);
    await em.flush();
    em.clear();

    const slugsIn = (groups: { constructions: { slug: string }[] }[]) =>
      groups.flatMap((g) => g.constructions.map((c) => c.slug)).sort();

    const byCategory = await suite.query(
      new GetGrammarReferenceQuery(BY_CATEGORY),
    );
    const byCefr = await suite.query(
      new GetGrammarReferenceQuery({
        ...BY_CATEGORY,
        groupBy: GrammarGroupBy.Cefr,
      }),
    );
    const byTime = await suite.query(
      new GetGrammarReferenceQuery({
        ...BY_CATEGORY,
        groupBy: GrammarGroupBy.Time,
      }),
    );

    expect(slugsIn(byCefr.groups)).toEqual(slugsIn(byCategory.groups));
    expect(slugsIn(byTime.groups)).toEqual(slugsIn(byCategory.groups));
    // Easiest level (B2) wins the bucket; a category off the tense axis is Other.
    expect(
      byCefr.groups
        .find((g) => g.key === CefrLevel.B2)
        ?.constructions.some((c) => c.slug.startsWith(other.toLowerCase())),
    ).toBe(true);
    expect(
      byTime.groups
        .find((g) => g.key === 'other')
        ?.constructions.some((c) => c.slug.startsWith(other.toLowerCase())),
    ).toBe(true);
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
      return view.groups
        .flatMap((group) => group.constructions)
        .find((construction) => construction.slug === slug)?.state;
    }

    it('is New for a guest', async () => {
      const { slug } = await seedOneConstruction(suite.orm.em, [CefrLevel.A1]);
      suite.orm.em.clear();

      expect(
        await stateOf(new GetGrammarReferenceQuery(BY_CATEGORY), slug),
      ).toBe('new');
    });

    async function progressOf(
      query: GetGrammarReferenceQuery,
      slug: string,
    ): Promise<{ state: string; learnedCount?: number } | undefined> {
      const view = await suite.query(query);
      return view.groups
        .flatMap((group) => group.constructions)
        .find((construction) => construction.slug === slug);
    }

    function seedCard(
      em: EntityManager,
      userId: string,
      pointId: string,
      overrides: Partial<{
        state: LearningCardState;
        scheduledDays: number;
      }> = {},
    ): void {
      em.create(LearningCard, {
        userId,
        grammarUsagePointId: pointId,
        due: DateTime.now(),
        stability: 1,
        difficulty: 1,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: LearningCardState.Learning,
        ...overrides,
      });
    }

    it('has no learnedCount for a guest', async () => {
      const { slug } = await seedOneConstruction(suite.orm.em, [CefrLevel.A1]);
      suite.orm.em.clear();

      expect(
        (await progressOf(new GetGrammarReferenceQuery(BY_CATEGORY), slug))
          ?.learnedCount,
      ).toBeUndefined();
    });

    it('is Learning with 0 resolved when one point has a fresh card and the other is untouched', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const { slug, pointIds } = await seedOneConstruction(suite.orm.em, [
        CefrLevel.B1,
        CefrLevel.B1,
      ]);
      seedCard(suite.orm.em, user.id, pointIds[0]);
      await suite.orm.em.flush();
      suite.orm.em.clear();

      expect(
        await progressOf(
          new GetGrammarReferenceQuery(BY_CATEGORY, user.id),
          slug,
        ),
      ).toMatchObject({ state: 'learning', learnedCount: 0 });
    });

    it('is Learning with 1 resolved when only one of two points is Known', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const { slug, pointIds } = await seedOneConstruction(suite.orm.em, [
        CefrLevel.B1,
        CefrLevel.B1,
      ]);
      suite.orm.em.create(LearningDisposition, {
        userId: user.id,
        grammarUsagePointId: pointIds[0],
        disposition: Disposition.Known,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      expect(
        await progressOf(
          new GetGrammarReferenceQuery(BY_CATEGORY, user.id),
          slug,
        ),
      ).toMatchObject({ state: 'learning', learnedCount: 1 });
    });

    it('is Learned when every point is Known or Skipped', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const { slug, pointIds } = await seedOneConstruction(suite.orm.em, [
        CefrLevel.B1,
        CefrLevel.B1,
      ]);
      suite.orm.em.create(LearningDisposition, {
        userId: user.id,
        grammarUsagePointId: pointIds[0],
        disposition: Disposition.Known,
      });
      suite.orm.em.create(LearningDisposition, {
        userId: user.id,
        grammarUsagePointId: pointIds[1],
        disposition: Disposition.Skipped,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      expect(
        await progressOf(
          new GetGrammarReferenceQuery(BY_CATEGORY, user.id),
          slug,
        ),
      ).toMatchObject({ state: 'learned', learnedCount: 2 });
    });

    it('ignores the CEFR default: a below-level construction with no activity stays New', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.B2);
      const { slug } = await seedOneConstruction(suite.orm.em, [CefrLevel.A1]);
      suite.orm.em.clear();

      expect(
        await progressOf(
          new GetGrammarReferenceQuery(BY_CATEGORY, user.id),
          slug,
        ),
      ).toMatchObject({ state: 'new', learnedCount: 0 });
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
        await stateOf(new GetGrammarReferenceQuery(BY_CATEGORY, user.id), slug),
      ).toBe('skipped');
    });
  });
});
