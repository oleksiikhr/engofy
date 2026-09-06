import { Migration } from '@mikro-orm/migrations';

export class Migration20260829141156 extends Migration {
  override name = 'Migration20260829141156';

  override up(): void | Promise<void> {
    this.addSql(`alter table "posts" add "cefr_level" text null;`);
    this.addSql(
      `alter table "posts" add constraint "posts_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "posts" drop constraint "posts_cefr_level_check";`,
    );
    this.addSql(`alter table "posts" drop column "cefr_level";`);
  }
}
