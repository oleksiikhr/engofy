import { Migration } from '@mikro-orm/migrations';

export class Migration20260926122732 extends Migration {
  override name = 'Migration20260926122732';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "streak_freezes" ("id" uuid not null, "user_id" uuid not null, "covered_date" varchar(10) not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "streak_freezes" add constraint "streak_freezes_user_id_covered_date_unique" unique ("user_id", "covered_date");`,
    );

    this.addSql(
      `alter table "streak_freezes" add constraint "streak_freezes_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "streak_freezes" cascade;`);
  }
}
