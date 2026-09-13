import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { DailyPlan } from '../../entities/daily-plan.entity.js';
import { DailyPlanNotFoundError } from '../../errors/daily-plan-not-found.error.js';
import { CompleteDailyPlanCommand } from './complete-daily-plan.command.js';

// Marks today's daily plan finished (daily-session-home plan, зріз 3, крок
// 3's final screen) — idempotent: a repeat call (e.g. a double submit) keeps
// the first completion timestamp rather than pushing it forward. Mutates the
// managed entity only; the facade (HomeService) flushes, per the repo's
// handlers-never-flush rule.
@CommandHandler(CompleteDailyPlanCommand)
export class CompleteDailyPlanHandler
  implements ICommandHandler<CompleteDailyPlanCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: CompleteDailyPlanCommand): Promise<DateTime> {
    const planDate = DateTime.now().toUTC().startOf('day');
    const plan = await this.em.findOne(DailyPlan, { userId, planDate });
    if (!plan) {
      throw new DailyPlanNotFoundError();
    }

    if (!plan.completedAt) {
      plan.completedAt = DateTime.now();
    }
    return plan.completedAt;
  }
}
