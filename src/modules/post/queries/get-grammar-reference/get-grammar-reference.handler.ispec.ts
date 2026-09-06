import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostModule } from '../../post.module.js';
import { GetGrammarReferenceQuery } from './get-grammar-reference.query.js';

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
});
