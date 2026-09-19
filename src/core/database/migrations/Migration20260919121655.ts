import { Migration } from '@mikro-orm/migrations';

export class Migration20260919121655 extends Migration {
  override name = 'Migration20260919121655';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "exercises" drop constraint "exercises_type_check";`,
    );
    this.addSql(
      `alter table "exercises" add constraint "exercises_type_check" check ("type" in ('fill_blank', 'find_error', 'multiple_choice', 'comprehension', 'grammar_contrastive', 'reorder'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "exercises" drop constraint "exercises_type_check";`,
    );
    this.addSql(
      `alter table "exercises" add constraint "exercises_type_check" check ("type" in ('fill_blank', 'find_error', 'multiple_choice', 'comprehension', 'reorder'));`,
    );
  }
}
