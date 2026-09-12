import { Migration } from '@mikro-orm/migrations';

export class Migration20260912105932 extends Migration {
  override name = 'Migration20260912105932';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "post_reads" ("id" uuid not null, "user_id" uuid not null, "post_id" uuid not null, "read_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "post_reads" add constraint "post_reads_user_id_post_id_unique" unique ("user_id", "post_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "post_reads" cascade;`);
  }
}
