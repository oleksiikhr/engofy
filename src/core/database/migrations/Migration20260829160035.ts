import { Migration } from '@mikro-orm/migrations';

export class Migration20260829160035 extends Migration {
  override name = 'Migration20260829160035';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_grammar_usage_point_id_unique" unique ("user_id", "grammar_usage_point_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_phrase_id_unique" unique ("user_id", "phrase_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_word_id_unique" unique ("user_id", "word_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_grammar_usage_point_id_unique";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_phrase_id_unique";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_user_id_word_id_unique";`,
    );
  }
}
