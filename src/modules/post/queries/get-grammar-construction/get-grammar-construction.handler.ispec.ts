import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Disposition } from '../../../learning/enums/disposition.enum.js';
import { LearningCardState } from '../../../learning/enums/learning-card-state.enum.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostModule } from '../../post.module.js';
import { GetGrammarConstructionQuery } from './get-grammar-construction.query.js';

function seedConstruction(
  em: EntityManager,
  slug: string,
): { a2PointId: string; b1PointId: string } {
  const category = factories(em).grammarCategory.makeOne({
    name: `TENSES-${uuidv7().slice(0, 8)}`,
    sortOrder: 1,
  });
  const construction = factories(em).grammarConstruction.makeOne({
    categoryId: category.id,
    name: 'present perfect',
    slug,
    cheatSheetContent: '## Form\nhave/has + past participle',
    sortOrder: 1,
  });
  // Inserted B1 before A2 on purpose — the handler must sort by CEFR.
  const b1 = factories(em).grammarUsagePoint.makeOne({
    constructionId: construction.id,
    cefrLevel: CefrLevel.B1,
    guideword: 'USE: EXPERIENCE',
    canDoStatement: 'Can talk about life experience.',
  });
  const a2 = factories(em).grammarUsagePoint.makeOne({
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
    expect(view?.usagePoints.every((p) => !p.assumedKnown)).toBe(true);
    expect(view?.levelProgress).toBeUndefined();
  });

  describe('per-point state (grammar-page-redesign зріз 1)', () => {
    it('gives one point Learning (active card) and leaves the other New', async () => {
      const user = await suite.factories.user.createOne({
        cefrLevel: CefrLevel.A1,
      });
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      const { a2PointId } = seedConstruction(suite.orm.em, slug);
      suite.factories.learningCard.makeOne({
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
      const user = await suite.factories.user.createOne({
        cefrLevel: CefrLevel.A1,
      });
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      const { b1PointId } = seedConstruction(suite.orm.em, slug);
      suite.factories.learningDisposition.makeOne({
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

  describe('assumed known and per-level progress', () => {
    it('keeps a below-level point New but flags it assumedKnown', async () => {
      const user = await suite.factories.user.createOne({
        cefrLevel: CefrLevel.A2,
      });
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      seedConstruction(suite.orm.em, slug);
      await suite.orm.em.flush();
      suite.orm.em.clear();

      const view = await suite.query(
        new GetGrammarConstructionQuery(slug, user.id),
      );

      const byLevel = new Map(view?.usagePoints.map((p) => [p.cefrLevel, p]));
      expect(byLevel.get(CefrLevel.A2)).toMatchObject({
        state: 'new',
        assumedKnown: true,
      });
      expect(byLevel.get(CefrLevel.B1)).toMatchObject({
        state: 'new',
        assumedKnown: false,
      });
    });

    it('reports resolved / total per level, easiest first, without counting assumed-known points', async () => {
      const user = await suite.factories.user.createOne({
        cefrLevel: CefrLevel.B2,
      });
      const slug = `present-perfect-${uuidv7().slice(0, 8)}`;
      const { b1PointId } = seedConstruction(suite.orm.em, slug);
      suite.factories.learningDisposition.makeOne({
        userId: user.id,
        grammarUsagePointId: b1PointId,
        disposition: Disposition.Known,
      });
      await suite.orm.em.flush();
      suite.orm.em.clear();

      const view = await suite.query(
        new GetGrammarConstructionQuery(slug, user.id),
      );

      expect(view?.levelProgress).toEqual([
        { cefrLevel: CefrLevel.A2, learnedCount: 0, totalCount: 1 },
        { cefrLevel: CefrLevel.B1, learnedCount: 1, totalCount: 1 },
      ]);
    });
  });
});
