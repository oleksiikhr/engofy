import { Migration } from '@mikro-orm/migrations';

export class Migration20260825153012 extends Migration {
  override name = 'Migration20260825153012';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "word_definitions" alter column "cefr_level" drop not null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "word_definitions" alter column "cefr_level" set not null;`,
    );
  }
}
