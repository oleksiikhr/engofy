import { Migration } from '@mikro-orm/migrations';

export class Migration20260920090000 extends Migration {
  override name = 'Migration20260920090000';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "posts" add "stuck_notified_at" timestamp with time zone null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop column "stuck_notified_at";`);
  }
}
