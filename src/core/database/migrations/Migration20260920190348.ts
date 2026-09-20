import { Migration } from '@mikro-orm/migrations';

export class Migration20260920190348 extends Migration {
  override name = 'Migration20260920190348';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" add "translations" jsonb null;`,
    );

    this.addSql(`alter table "phrases" add "translations" jsonb null;`);

    this.addSql(
      `alter table "word_definitions" add "translations" jsonb null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" drop column "translations";`,
    );

    this.addSql(`alter table "phrases" drop column "translations";`);

    this.addSql(`alter table "word_definitions" drop column "translations";`);
  }
}
