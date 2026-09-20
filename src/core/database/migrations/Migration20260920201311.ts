import { Migration } from '@mikro-orm/migrations';

export class Migration20260920201311 extends Migration {
  override name = 'Migration20260920201311';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "users" add "daily_goal" int not null default 10;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "users" drop column "daily_goal";`);
  }
}
