import { Migration } from '@mikro-orm/migrations';

// learning-foundation slice 3: `learning_cards.word_id` -> `word_definition_id`
// (a word card now targets one POS sense, not the whole word) — a direct
// rename since there is no deployed data to migrate (no `v*` tag pushed yet).
export class Migration20260913121205 extends Migration {
  override name = 'Migration20260913121205';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_word_id_unique";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_exactly_one_target";`,
    );
    this.addSql(
      `alter table "learning_cards" rename column "word_id" to "word_definition_id";`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_word_definition_id_unique" unique ("user_id", "word_definition_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_exactly_one_target" check ((word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_word_definition_id_unique";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_exactly_one_target";`,
    );
    this.addSql(
      `alter table "learning_cards" rename column "word_definition_id" to "word_id";`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_word_id_unique" unique ("user_id", "word_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_exactly_one_target" check ((word_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
  }
}
