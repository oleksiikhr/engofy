import { Migration } from '@mikro-orm/migrations';

export class Migration20260920071233 extends Migration {
  override name = 'Migration20260920071233';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "posts" add "failure_notified_at" timestamp with time zone null;`,
    );
    // Posts already failed before alerts existed must not all page the admin on
    // the first tick.
    this.addSql(
      `update "posts" set "failure_notified_at" = now() where "status" = 'failed';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop column "failure_notified_at";`);
  }
}
