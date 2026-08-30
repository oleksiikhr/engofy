import { Migration } from '@mikro-orm/migrations';

// D12: `review_logs` carried both `reviewed_at` and `created_at` for the same
// instant. `reviewed_at` is the meaningful one (it drives streak/stats and can
// be backdated when rebuilding history); drop the redundant `created_at`.
export class Migration20260830120300 extends Migration {
  override name = 'Migration20260830120300';

  override up(): void | Promise<void> {
    this.addSql(`alter table "review_logs" drop column "created_at";`);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "review_logs" add column "created_at" timestamptz(6) not null default now();`,
    );
  }
}
