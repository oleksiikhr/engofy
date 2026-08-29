import { Migration } from '@mikro-orm/migrations';

// Postgres doesn't rename a table's implicit primary-key constraint (and its
// backing index) when the table itself is renamed via `RENAME TO` — only an
// explicit `RENAME CONSTRAINT` does that. Migration20260826081301 renamed
// contents/content_parts/content_pipeline_runs to posts/post_parts/
// post_pipeline_runs but left their `*_pkey` constraints on the old names.
export class Migration20260826081416 extends Migration {
  override name = 'Migration20260826081416';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "posts" rename constraint "contents_pkey" to "posts_pkey";`,
    );
    this.addSql(
      `alter table "post_parts" rename constraint "content_parts_pkey" to "post_parts_pkey";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "content_pipeline_runs_pkey" to "post_pipeline_runs_pkey";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "post_pipeline_runs_pkey" to "content_pipeline_runs_pkey";`,
    );
    this.addSql(
      `alter table "post_parts" rename constraint "post_parts_pkey" to "content_parts_pkey";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "posts_pkey" to "contents_pkey";`,
    );
  }
}
