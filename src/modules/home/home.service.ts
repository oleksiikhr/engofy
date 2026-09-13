import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { DateTime } from 'luxon';
import { CompleteDailyPlanCommand } from './commands/complete-daily-plan/complete-daily-plan.command.js';
import { CreateDailyPlanCommand } from './commands/create-daily-plan/create-daily-plan.command.js';
import type { DailyPlanView } from './queries/get-daily-plan/daily-plan-view.js';
import { GetDailyPlanQuery } from './queries/get-daily-plan/get-daily-plan.query.js';
import type { DailySessionSummaryView } from './queries/get-daily-session-summary/daily-session-summary-view.js';
import { GetDailySessionSummaryQuery } from './queries/get-daily-session-summary/get-daily-session-summary.query.js';
import { SelectDailyPlanCandidateQuery } from './queries/select-daily-plan-candidate/select-daily-plan-candidate.query.js';

@Injectable()
export class HomeService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async getDailyPlan(userId: string): Promise<DailyPlanView> {
    const existing = await this.queryBus.execute(new GetDailyPlanQuery(userId));
    if (existing) {
      return existing;
    }

    const candidate = await this.queryBus.execute(
      new SelectDailyPlanCandidateQuery(userId),
    );
    await this.commandBus.execute(
      new CreateDailyPlanCommand(
        userId,
        candidate.postId,
        candidate.grammarUsagePointId,
      ),
    );
    await this.em.flush();

    const created = await this.queryBus.execute(new GetDailyPlanQuery(userId));
    if (!created) {
      // The upsert above just committed today's row (or found one from a
      // concurrent request racing this same call) — this is unreachable
      // under normal operation.
      throw new Error('daily plan missing immediately after being created');
    }
    return created;
  }

  // Marks today's session finished and returns the final-screen summary
  // (daily-session-home plan, зріз 3).
  async completeDailyPlan(userId: string): Promise<{
    completedAt: DateTime;
    newCardsToday: number;
    reviewsToday: number;
  }> {
    const completedAt = await this.commandBus.execute(
      new CompleteDailyPlanCommand(userId),
    );
    await this.em.flush();

    const summary: DailySessionSummaryView = await this.queryBus.execute(
      new GetDailySessionSummaryQuery(userId),
    );

    return { completedAt, ...summary };
  }
}
