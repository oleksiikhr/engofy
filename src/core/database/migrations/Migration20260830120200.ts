import { Migration } from '@mikro-orm/migrations';

// D12 / PLAN.md §9 (copyright — legal): every post must carry a source type and
// a human-readable attribution line. Adds `PostSource.type` + `.attributionText`
// (both NOT NULL). Existing rows are backfilled as `original` with the source
// link (or a generic label) as the attribution text before the NOT NULL flip.
export class Migration20260830120200 extends Migration {
  override name = 'Migration20260830120200';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "posts" add column "source_type" text null default 'original';`,
    );
    this.addSql(
      `alter table "posts" add column "source_attribution_text" text null default 'Original content';`,
    );
    this.addSql(
      `update "posts" set "source_type" = 'original' where "source_type" is null;`,
    );
    this.addSql(
      `update "posts" set "source_attribution_text" = coalesce(nullif("source_link", ''), 'Original content') where "source_attribution_text" is null;`,
    );
    this.addSql(`alter table "posts" alter column "source_type" set not null;`);
    this.addSql(
      `alter table "posts" alter column "source_attribution_text" set not null;`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_source_type_check" check ("source_type" in ('original', 'excerpt', 'reddit_comment', 'news_snippet'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "posts" drop constraint "posts_source_type_check";`,
    );
    this.addSql(`alter table "posts" drop column "source_attribution_text";`);
    this.addSql(`alter table "posts" drop column "source_type";`);
  }
}
