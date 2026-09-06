import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { cefrRank } from '../../domain/cefr-order.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { GetGrammarReferenceQuery } from './get-grammar-reference.query.js';
import type {
  GrammarReferenceCategoryView,
  GrammarReferenceConstructionView,
  GrammarReferenceView,
} from './grammar-reference-view.js';

// Backs the `/grammar` reference index (PLAN.md §4): 19 categories → ~90
// constructions, each with its easiest CEFR level and usage-point count. The
// optional `cefr` filter keeps only constructions that teach something at
// that level.
@QueryHandler(GetGrammarReferenceQuery)
export class GetGrammarReferenceHandler
  implements IQueryHandler<GetGrammarReferenceQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    cefr,
  }: GetGrammarReferenceQuery): Promise<GrammarReferenceView> {
    const [categories, constructions, usagePoints] = await Promise.all([
      this.em.find(
        GrammarCategory,
        {},
        { orderBy: { sortOrder: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(
        GrammarConstruction,
        {},
        { orderBy: { sortOrder: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(GrammarUsagePoint, {}, { disableIdentityMap: true }),
    ]);

    const pointsByConstruction = new Map<string, GrammarUsagePoint[]>();
    for (const point of usagePoints) {
      const list = pointsByConstruction.get(point.constructionId) ?? [];
      list.push(point);
      pointsByConstruction.set(point.constructionId, list);
    }

    const constructionsByCategory = new Map<string, GrammarConstruction[]>();
    for (const construction of constructions) {
      const list = constructionsByCategory.get(construction.categoryId) ?? [];
      list.push(construction);
      constructionsByCategory.set(construction.categoryId, list);
    }

    const result: GrammarReferenceCategoryView[] = [];
    for (const category of categories) {
      const views: GrammarReferenceConstructionView[] = [];
      for (const construction of constructionsByCategory.get(category.id) ??
        []) {
        const points = pointsByConstruction.get(construction.id) ?? [];
        if (cefr && !points.some((point) => point.cefrLevel === cefr)) {
          continue;
        }
        views.push({
          slug: construction.slug,
          name: construction.name,
          cefrLevel: easiestLevel(points),
          usagePointCount: points.length,
        });
      }
      if (views.length > 0) {
        result.push({ name: category.name, constructions: views });
      }
    }

    return { categories: result };
  }
}

function easiestLevel(points: GrammarUsagePoint[]) {
  if (points.length === 0) {
    return null;
  }
  return [...points].sort(
    (a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel),
  )[0].cefrLevel;
}
