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
import { GetGrammarConstructionQuery } from './get-grammar-construction.query.js';

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

function seedConstruction(
  em: EntityManager,
  slug: string,
): { a2PointId: string; b1PointId: string } {
  const category = em.create(GrammarCategory, {
    name: `TENSES-${uuidv7().slice(0, 8)}`,
    sortOrder: 1,
  });
  const construction = em.create(GrammarConstruction, {
    categoryId: category.id,
    name: 'present perfect',
    slug,
    cheatSheetContent: '## Form\nhave/has + past participle',
    sortOrder: 1,
  });
  // Inserted B1 before A2 on purpose — the handler must sort by CEFR.
  const b1 = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.B1,
    guideword: 'USE: EXPERIENCE',
    canDoStatement: 'Can talk about life experience.',
  });
  const a2 = em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.A2,
    guideword: 'USE: RECENT PAST',
    canDoStatement: 'Can talk about recent events.',
  });
  return { a2PointId: a2.id, b1PointId: b1.id };
}

describe('GetGrammarConstructionHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns null for an unknown slug', async () => {
    expect(
      await suite.query(new GetGrammarConstructionQuery('no-such-slug')),
    ).toBeNull();
  });

  it('returns the cheat sheet, category name and usage points sorted by CEFR', async () => {
    const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
    seedConstruction(suite.orm.em, slug);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const view = await suite.query(new GetGrammarConstructionQuery(slug));

    expect(view?.name).toBe('present perfect');
    expect(view?.categoryName.startsWith('TENSES-')).toBe(true);
    expect(view?.cheatSheetContent).toContain('past participle');
    expect(view?.usagePoints.map((p) => p.cefrLevel)).toEqual([
      CefrLevel.A2,
      CefrLevel.B1,
    ]);
    // Construction level is the easiest of its points.
    expect(view?.cefrLevel).toBe(CefrLevel.A2);
    // A guest gets every usage point New, no DB join.
    expect(view?.usagePoints.every((p) => p.state === 'new')).toBe(true);
  });

  describe('per-point state (grammar-page-redesign зріз 1)', () => {
    it('gives one point Learning (active card) and leaves the other New', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      const { a2PointId } = seedConstruction(suite.orm.em, slug);
      suite.orm.em.create(LearningCard, {
        userId: user.id,
        grammarUsagePointId: a2PointId,
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

      const view = await suite.query(
        new GetGrammarConstructionQuery(slug, user.id),
      );

      const byLevel = new Map(
        view?.usagePoints.map((p) => [p.cefrLevel, p.state]),
      );
      expect(byLevel.get(CefrLevel.A2)).toBe('learning');
      expect(byLevel.get(CefrLevel.B1)).toBe('new');
    });

    it('is Skipped for a point the learner dismissed', async () => {
      const user = await seedUser(suite.orm.em, CefrLevel.A1);
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      const { b1PointId } = seedConstruction(suite.orm.em, slug);
      suite.orm.em.create(LearningDisposition, {
        userId: user.id,
        grammarUsagePointId: b1PointId,
        disposition: Disposition.Skipped,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      const view = await suite.query(
        new GetGrammarConstructionQuery(slug, user.id),
      );

      const byLevel = new Map(
        view?.usagePoints.map((p) => [p.cefrLevel, p.state]),
      );
      expect(byLevel.get(CefrLevel.B1)).toBe('skipped');
      expect(byLevel.get(CefrLevel.A2)).toBe('new');
    });
  });
});
