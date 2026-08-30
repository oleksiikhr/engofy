import { Migration } from '@mikro-orm/migrations';

// D12: `SubscriptionStatus.Expired` was never written — a lapsed subscription
// is derived from `current_period_end <= now()` at read time (PLAN.md §8).
// Drop `'expired'` from the CHECK. (The entity also moved to modules/billing,
// but the table is unchanged by that.)
export class Migration20260830120600 extends Migration {
  override name = 'Migration20260830120600';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "subscriptions" drop constraint "subscriptions_status_check";`,
    );
    this.addSql(
      `update "subscriptions" set "status" = 'active' where "status" = 'expired';`,
    );
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_status_check" check ("status" in ('active'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "subscriptions" drop constraint "subscriptions_status_check";`,
    );
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_status_check" check ("status" in ('active', 'expired'));`,
    );
  }
}
