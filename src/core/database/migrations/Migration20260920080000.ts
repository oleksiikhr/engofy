import { Migration } from '@mikro-orm/migrations';

export class Migration20260920080000 extends Migration {
  override name = 'Migration20260920080000';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "posts" add "publish_notified_at" timestamp with time zone null;`,
    );
    // Posts already published before notices existed must not all ping the
    // admin on the first tick.
    this.addSql(
      `update "posts" set "publish_notified_at" = now() where "status" = 'published';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop column "publish_notified_at";`);
  }
}
