import { Migration } from '@mikro-orm/migrations';

export class Migration20260919082400 extends Migration {
  override name = 'Migration20260919082400';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "account_deletion_requests" ("id" uuid not null, "user_id" uuid not null, "requested_at" timestamp with time zone not null, "cancel_token_hash" text not null, "cancelled_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "account_deletion_requests_user_id_index" on "account_deletion_requests" ("user_id");`,
    );
    this.addSql(
      `alter table "account_deletion_requests" add constraint "account_deletion_requests_cancel_token_hash_unique" unique ("cancel_token_hash");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "account_deletion_requests" cascade;`);
  }
}
