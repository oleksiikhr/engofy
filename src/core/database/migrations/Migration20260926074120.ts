import { Migration } from '@mikro-orm/migrations';

export class Migration20260926074120 extends Migration {
  override name = 'Migration20260926074120';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "grammar_usage_point_exercises" ("id" uuid not null, "usage_point_id" uuid not null, "type" text not null, "payload" jsonb not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "grammar_usage_point_exercises_usage_point_id_index" on "grammar_usage_point_exercises" ("usage_point_id");`,
    );

    this.addSql(
      `alter table "grammar_usage_point_exercises" add constraint "grammar_usage_point_exercises_usage_point_id_foreign" foreign key ("usage_point_id") references "grammar_usage_points" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "grammar_usage_point_exercises" add constraint "grammar_usage_point_exercises_type_check" check ("type" in ('fill_blank', 'find_error', 'multiple_choice', 'grammar_contrastive', 'reorder'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `drop table if exists "grammar_usage_point_exercises" cascade;`,
    );
  }
}
