import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { CreateDailyPlanCommand } from './create-daily-plan.command.js';

// Find-or-create for today's daily plan (daily-session-home plan, зріз 1).
// Two concurrent first-requests-of-the-day for the same user race here; the
// loser's `ON CONFLICT DO NOTHING` is silently ignored rather than throwing,
// same idiom as `AddCardHandler` / `MarkPostReadHandler`. Raw SQL rather than
// `em.upsert` (M3/DP5): MikroORM v7's upsert re-selects the conflicting row
// through a path that skips the `plan_date` column's custom type conversion,
// binding the Luxon `DateTime` as its raw epoch-millis numeric value and
// failing with `operator does not exist: date = bigint`. Plain uuid/string
// conflict targets elsewhere in the repo (`email`, `userId+wordDefinitionId`,
// …) never hit this because they have no custom-typed column in the mix.
@CommandHandler(CreateDailyPlanCommand)
export class CreateDailyPlanHandler
  implements ICommandHandler<CreateDailyPlanCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    postId,
    grammarUsagePointId,
  }: CreateDailyPlanCommand): Promise<void> {
    const planDate = DateTime.now().toUTC().toISODate();

    await this.em.getConnection().execute(
      `insert into "daily_plans" ("id", "user_id", "plan_date", "post_id", "grammar_usage_point_id", "created_at")
         values (?, ?, ?, ?, ?, now())
         on conflict ("user_id", "plan_date") do nothing`,
      [uuidv7(), userId, planDate, postId, grammarUsagePointId],
      'run',
      this.em.getTransactionContext(),
    );
  }
}
