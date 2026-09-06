import { Migration } from '@mikro-orm/migrations';

// D12: the column stores Telegram's `update.update_id` (used to derive the next
// getUpdates offset), not a `message.message_id`. Rename column + unique
// constraint to match what it holds and PLAN.md §3.9.
export class Migration20260830120400 extends Migration {
  override name = 'Migration20260830120400';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "telegram_updates" rename column "telegram_message_id" to "update_id";`,
    );
    this.addSql(
      `alter table "telegram_updates" rename constraint "telegram_updates_telegram_message_id_unique" to "telegram_updates_update_id_unique";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "telegram_updates" rename constraint "telegram_updates_update_id_unique" to "telegram_updates_telegram_message_id_unique";`,
    );
    this.addSql(
      `alter table "telegram_updates" rename column "update_id" to "telegram_message_id";`,
    );
  }
}
