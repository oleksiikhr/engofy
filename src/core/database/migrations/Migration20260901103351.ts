import { Migration } from '@mikro-orm/migrations';

export class Migration20260901103351 extends Migration {
  override name = 'Migration20260901103351';

  override up(): void | Promise<void> {
    this.addSql(
      `create index "sentence_tokens_word_id_index" on "sentence_tokens" ("word_id");`,
    );
    this.addSql(
      `create index "sentence_tokens_phrase_id_index" on "sentence_tokens" ("phrase_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "sentence_tokens_word_id_index";`);
    this.addSql(`drop index "sentence_tokens_phrase_id_index";`);
  }
}
