import { Migration } from '@mikro-orm/migrations';

export class Migration20260824160414 extends Migration {
  override name = 'Migration20260824160414';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "content_parts" ("id" uuid not null, "content_id" uuid not null, "block_index" int not null, "item_index" int null, "kind" text not null, "list_ordered" boolean null, "body" jsonb not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "content_parts_content_block_item_unique_idx" on "content_parts" ("content_id", "block_index", coalesce("item_index", -1));`,
    );

    this.addSql(
      `alter table "content_parts" add constraint "content_parts_kind_check" check ("kind" in ('paragraph', 'list_item'));`,
    );

    this.addSql(`alter table "contents" drop column "body";`);

    this.addSql(`alter table "phrases" add "type" text null;`);
    this.addSql(
      `alter table "phrases" add constraint "phrases_type_check" check ("type" in ('phrasal_verb', 'idiom', 'collocation', 'other'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "content_parts" cascade;`);

    this.addSql(`alter table "contents" add "body" jsonb not null;`);

    this.addSql(`alter table "phrases" drop constraint "phrases_type_check";`);
    this.addSql(`alter table "phrases" drop column "type";`);
  }
}
