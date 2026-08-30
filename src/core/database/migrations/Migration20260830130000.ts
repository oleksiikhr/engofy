import { Migration } from '@mikro-orm/migrations';

// D15 #30: a `failed` telegram post_publications row used to be terminal — a
// transient Telegram 5xx permanently dropped the channel announcement.
// `PublishPendingService` now re-selects `failed` rows with a bounded
// `retry_count` + backoff, and `/retry` resets them. Adds the counter column
// (NOT NULL, defaults to 0 so existing rows backfill).
export class Migration20260830130000 extends Migration {
  override name = 'Migration20260830130000';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "post_publications" add column "retry_count" int not null default 0;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "post_publications" drop column "retry_count";`);
  }
}
