import { Migration } from '@mikro-orm/migrations';

export class Migration20260829123821 extends Migration {
  override name = 'Migration20260829123821';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "subscriptions" ("id" uuid not null, "user_id" uuid not null, "plan" text not null, "status" text not null default 'active', "started_at" timestamp with time zone not null, "current_period_end" timestamp with time zone not null, "is_mock_payment" boolean not null default true, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "subscriptions_user_id_index" on "subscriptions" ("user_id");`,
    );

    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_plan_check" check ("plan" in ('free', 'premium'));`,
    );
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_status_check" check ("status" in ('active', 'expired'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "subscriptions" cascade;`);
  }
}
