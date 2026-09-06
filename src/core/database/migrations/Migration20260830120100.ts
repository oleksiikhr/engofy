import { Migration } from '@mikro-orm/migrations';

// D12: collapse the annotation-centric `posts.status` values
// `annotating`/`annotated` into a single `processing` — the pipeline has more
// stages than annotation, and per-stage progress lives on `post_pipeline_runs`
// (PLAN.md §3.2). `pending`/`published`/`failed` are unchanged.
export class Migration20260830120100 extends Migration {
  override name = 'Migration20260830120100';

  override up(): void | Promise<void> {
    this.addSql(`alter table "posts" drop constraint "posts_status_check";`);
    this.addSql(
      `update "posts" set "status" = 'processing' where "status" in ('annotating', 'annotated');`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check ("status" in ('pending', 'processing', 'published', 'failed'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop constraint "posts_status_check";`);
    this.addSql(
      `update "posts" set "status" = 'annotating' where "status" = 'processing';`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check ("status" in ('pending', 'annotating', 'annotated', 'published', 'failed'));`,
    );
  }
}
