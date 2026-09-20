import { Migration } from '@mikro-orm/migrations';

export class Migration20260920124054 extends Migration {
  override name = 'Migration20260920124054';

  override up(): void | Promise<void> {
    this.addSql(
      `delete from "daily_plans" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `alter table "daily_plans" add constraint "daily_plans_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "daily_plans" drop constraint "daily_plans_post_id_foreign";`,
    );
  }
}
