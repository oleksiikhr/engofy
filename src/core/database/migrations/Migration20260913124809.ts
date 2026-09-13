import { Migration } from '@mikro-orm/migrations';

// daily-session-home plan, зріз 1: `daily_plans` — the find-or-create row
// per (user, UTC calendar day) selecting that day's post + grammar highlight.
export class Migration20260913124809 extends Migration {
  override name = 'Migration20260913124809';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "daily_plans" ("id" uuid not null, "user_id" uuid not null, "plan_date" date not null, "post_id" uuid not null, "grammar_usage_point_id" uuid null, "completed_at" timestamp with time zone null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "daily_plans" add constraint "daily_plans_user_id_plan_date_unique" unique ("user_id", "plan_date");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "daily_plans" cascade;`);
  }
}
