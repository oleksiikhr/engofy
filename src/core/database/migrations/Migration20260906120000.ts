import { Migration } from '@mikro-orm/migrations';

// db-performance: drop two more standalone indexes that only duplicate the
// leading column of a composite unique — the same cleanup Batch D
// (Migration20260830120500) did for sentence/sentence_token/grammar_match/
// learning_card, missed here. `(post_id)` is served by
// `post_publications_post_id_platform_unique`; `(user_id)` by
// `user_skill_progress_user_id_construction_id_unique`.
export class Migration20260906120000 extends Migration {
  override name = 'Migration20260906120000';

  override up(): void | Promise<void> {
    this.addSql(`drop index "post_publications_post_id_index";`);
    this.addSql(`drop index "user_skill_progress_user_id_index";`);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create index "user_skill_progress_user_id_index" on "user_skill_progress" ("user_id");`,
    );
    this.addSql(
      `create index "post_publications_post_id_index" on "post_publications" ("post_id");`,
    );
  }
}
