import { Migration } from '@mikro-orm/migrations';

// D12 / db-performance: drop standalone indexes that only duplicate the leading
// column of a composite unique, add the `grammar_matches` row-level dedupe
// safety net, and replace the two single-column `learning_cards` indexes with
// the `(user_id, due)` composite the practice queue actually uses.
export class Migration20260830120500 extends Migration {
  override name = 'Migration20260830120500';

  override up(): void | Promise<void> {
    this.addSql(`drop index "grammar_matches_sentence_id_index";`);
    this.addSql(
      `alter table "grammar_matches" add constraint "grammar_matches_sentence_id_grammar_usage_point_i_05997_unique" unique ("sentence_id", "grammar_usage_point_id", "token_start", "token_end");`,
    );

    this.addSql(`drop index "learning_cards_due_index";`);
    this.addSql(`drop index "learning_cards_user_id_index";`);
    this.addSql(
      `create index "learning_cards_user_id_due_index" on "learning_cards" ("user_id", "due");`,
    );

    this.addSql(`drop index "sentences_post_part_id_index";`);

    this.addSql(`drop index "sentence_tokens_sentence_id_index";`);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create index "sentence_tokens_sentence_id_index" on "sentence_tokens" ("sentence_id");`,
    );

    this.addSql(
      `create index "sentences_post_part_id_index" on "sentences" ("post_part_id");`,
    );

    this.addSql(`drop index "learning_cards_user_id_due_index";`);
    this.addSql(
      `create index "learning_cards_user_id_index" on "learning_cards" ("user_id");`,
    );
    this.addSql(
      `create index "learning_cards_due_index" on "learning_cards" ("due");`,
    );

    this.addSql(
      `alter table "grammar_matches" drop constraint "grammar_matches_sentence_id_grammar_usage_point_i_05997_unique";`,
    );
    this.addSql(
      `create index "grammar_matches_sentence_id_index" on "grammar_matches" ("sentence_id");`,
    );
  }
}
