import { Migration } from '@mikro-orm/migrations';

export class Migration20260920184728 extends Migration {
  override name = 'Migration20260920184728';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" add "learner_explanation_uk" text null;`,
    );

    this.addSql(`alter table "phrases" add "translation_uk" text null;`);

    this.addSql(
      `alter table "word_definitions" add "translation_uk" text null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" drop column "learner_explanation_uk";`,
    );

    this.addSql(`alter table "phrases" drop column "translation_uk";`);

    this.addSql(`alter table "word_definitions" drop column "translation_uk";`);
  }
}
