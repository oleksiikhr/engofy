import { Migration } from '@mikro-orm/migrations';

export class Migration20260926074533 extends Migration {
  override name = 'Migration20260926074533';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "users" add "daily_new_card_limit_override" int null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "users" drop column "daily_new_card_limit_override";`,
    );
  }
}
