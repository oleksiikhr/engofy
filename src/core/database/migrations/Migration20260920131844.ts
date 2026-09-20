import { Migration } from '@mikro-orm/migrations';

export class Migration20260920131844 extends Migration {
  override name = 'Migration20260920131844';

  override up(): void | Promise<void> {
    // No FK existed before, so drop orphans (parents first) so the constraints
    // below can be added.
    this.addSql(
      `delete from "subscriptions" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "post_reads" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "learning_dispositions" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "learning_cards" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "daily_plans" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "account_deletion_requests" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "user_skill_progress" where "user_id" not in (select "id" from "users");`,
    );
    this.addSql(
      `delete from "review_logs" where "card_id" not in (select "id" from "learning_cards");`,
    );

    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "post_reads" add constraint "post_reads_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "review_logs" add constraint "review_logs_card_id_foreign" foreign key ("card_id") references "learning_cards" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "daily_plans" add constraint "daily_plans_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "account_deletion_requests" add constraint "account_deletion_requests_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_skill_progress" add constraint "user_skill_progress_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "account_deletion_requests" drop constraint "account_deletion_requests_user_id_foreign";`,
    );

    this.addSql(
      `alter table "daily_plans" drop constraint "daily_plans_user_id_foreign";`,
    );

    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_foreign";`,
    );

    this.addSql(
      `alter table "learning_dispositions" drop constraint "learning_dispositions_user_id_foreign";`,
    );

    this.addSql(
      `alter table "post_reads" drop constraint "post_reads_user_id_foreign";`,
    );

    this.addSql(
      `alter table "review_logs" drop constraint "review_logs_card_id_foreign";`,
    );

    this.addSql(
      `alter table "subscriptions" drop constraint "subscriptions_user_id_foreign";`,
    );

    this.addSql(
      `alter table "user_skill_progress" drop constraint "user_skill_progress_user_id_foreign";`,
    );
  }
}
