import { Migration } from '@mikro-orm/migrations';

// `telegram_updates` was the last audit table without an `updated_at` — every
// other timestamped entity carries the `onCreate`/`onUpdate` pair. Add it to
// match. Backfill existing rows with `now()`, then drop the default so the
// column matches the entity (the app sets it, there is no DB default).
export class Migration20260901120000 extends Migration {
  override name = 'Migration20260901120000';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "telegram_updates" add column "updated_at" timestamp with time zone not null default now();`,
    );
    this.addSql(
      `alter table "telegram_updates" alter column "updated_at" drop default;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "telegram_updates" drop column "updated_at";`);
  }
}
