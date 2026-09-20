import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { GrammarConstruction } from '../../../post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { PostRead } from '../../../post/entities/post-read.entity.js';
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

    const [post, grammar, postRead] = await Promise.all([
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
      this.em.findOne(
        PostRead,
        { userId, postId: plan.postId },
        { disableIdentityMap: true },
      ),
    ]);
    // `findOne`, not `findOneOrFail` — a usage point with no matching
    // construction row just means no "learn more" link, not a broken plan.
    const construction = grammar
      ? await this.em.findOne(
          GrammarConstruction,
          { id: grammar.constructionId },
          { disableIdentityMap: true },
        )
      : null;

    return {
      postId: post.id,
      postShortId: post.shortId,
      postSlug: post.slug ?? null,
      postTitle: post.title ?? null,
      postCefrLevel: post.cefrLevel ?? null,
      isRead: !!postRead,
      grammarUsagePointId: grammar?.id ?? null,
      grammarGuideword: grammar?.guideword ?? null,
      grammarConstructionSlug: construction?.slug ?? null,
      grammarCanDoStatement: grammar?.canDoStatement ?? null,
      grammarExampleText: grammar?.learnerExamples?.[0] ?? null,
      completedAt: plan.completedAt ?? null,
    };
  }
}
