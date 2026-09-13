import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { DailyPlan } from '../../entities/daily-plan.entity.js';
import type { DailyPlanView } from './daily-plan-view.js';
import { GetDailyPlanQuery } from './get-daily-plan.query.js';

// Today's already-selected daily plan, hydrated with post/grammar display
// fields — null when nothing has been selected yet today (the facade then
// runs `SelectDailyPlanCandidateQuery` + `CreateDailyPlanCommand`).
@QueryHandler(GetDailyPlanQuery)
export class GetDailyPlanHandler implements IQueryHandler<GetDailyPlanQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetDailyPlanQuery): Promise<DailyPlanView | null> {
    const planDate = DateTime.now().toUTC().startOf('day');
    const plan = await this.em.findOne(
      DailyPlan,
      { userId, planDate },
      { disableIdentityMap: true },
    );
    if (!plan) {
      return null;
    }

    const [post, grammar] = await Promise.all([
      this.em.findOneOrFail(
        Post,
        { id: plan.postId },
        { disableIdentityMap: true },
      ),
      plan.grammarUsagePointId
        ? this.em.findOne(
            GrammarUsagePoint,
            { id: plan.grammarUsagePointId },
            { disableIdentityMap: true },
          )
        : Promise.resolve(null),
    ]);

    return {
      postShortId: post.shortId,
      postSlug: post.slug ?? null,
      postTitle: post.title ?? null,
      postCefrLevel: post.cefrLevel ?? null,
      grammarUsagePointId: grammar?.id ?? null,
      grammarGuideword: grammar?.guideword ?? null,
      grammarCanDoStatement: grammar?.canDoStatement ?? null,
      grammarExampleText: grammar?.exampleText ?? null,
      completedAt: plan.completedAt ?? null,
    };
  }
}
