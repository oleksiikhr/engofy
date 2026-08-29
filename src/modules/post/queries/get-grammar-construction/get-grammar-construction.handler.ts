import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { cefrRank } from '../../domain/cefr-order.js';
import { GrammarCategory } from '../../entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { GetGrammarConstructionQuery } from './get-grammar-construction.query.js';
import type {
  ConstructionUsagePointView,
  GrammarConstructionView,
} from './grammar-construction-view.js';

// Backs `/grammar/{slug}` (PLAN.md §4): one construction with its cheat sheet
// and its USE points. Returns null for an unknown slug (controller → 404).
@QueryHandler(GetGrammarConstructionQuery)
export class GetGrammarConstructionHandler
  implements IQueryHandler<GetGrammarConstructionQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    slug,
  }: GetGrammarConstructionQuery): Promise<GrammarConstructionView | null> {
    const construction = await this.em.findOne(GrammarConstruction, { slug });
    if (!construction) {
      return null;
    }

    const [category, points] = await Promise.all([
      this.em.findOne(GrammarCategory, { id: construction.categoryId }),
      this.em.find(GrammarUsagePoint, {
        constructionId: construction.id,
      }),
    ]);

    const sorted = [...points].sort(
      (a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel),
    );

    const usagePoints: ConstructionUsagePointView[] = sorted.map((point) => ({
      grammarUsagePointId: point.id,
      cefrLevel: point.cefrLevel,
      guideword: point.guideword,
      canDoStatement: point.canDoStatement,
      exampleText: point.exampleText ?? null,
    }));

    return {
      slug: construction.slug,
      name: construction.name,
      categoryName: category?.name ?? '',
      cheatSheetContent: construction.cheatSheetContent ?? null,
      cefrLevel: sorted[0]?.cefrLevel ?? null,
      usagePoints,
    };
  }
}
