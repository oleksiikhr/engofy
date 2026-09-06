import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostModule } from '../../post.module.js';
import { GetGrammarConstructionQuery } from './get-grammar-construction.query.js';

function seedConstruction(em: EntityManager, slug: string): void {
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
  em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.B1,
    guideword: 'USE: EXPERIENCE',
    canDoStatement: 'Can talk about life experience.',
  });
  em.create(GrammarUsagePoint, {
    constructionId: construction.id,
    cefrLevel: CefrLevel.A2,
    guideword: 'USE: RECENT PAST',
    canDoStatement: 'Can talk about recent events.',
  });
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
  });
});
