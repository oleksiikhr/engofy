import { Migration } from '@mikro-orm/migrations';

export class Migration20260824162815 extends Migration {
  override name = 'Migration20260824162815';

  override up(): void | Promise<void> {
    this.addSql(`drop index "content_parts_content_block_item_unique_idx";`);
    this.addSql(
      `alter table "content_parts" drop constraint "content_parts_kind_check";`,
    );
    this.addSql(
      `alter table "content_parts" drop column "item_index", drop column "list_ordered";`,
    );
    this.addSql(
      `alter table "content_parts" add constraint "content_parts_content_id_block_index_unique" unique ("content_id", "block_index");`,
    );
    this.addSql(
      `alter table "content_parts" add constraint "content_parts_kind_check" check ("kind" in ('paragraph', 'list'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "content_parts" drop constraint "content_parts_content_id_block_index_unique";`,
    );
    this.addSql(
      `alter table "content_parts" drop constraint "content_parts_kind_check";`,
    );
    this.addSql(
      `alter table "content_parts" add "item_index" int null, add "list_ordered" boolean null;`,
    );
    this.addSql(
      `create unique index "content_parts_content_block_item_unique_idx" on "content_parts" ("content_id", "block_index", coalesce("item_index", -1));`,
    );
    this.addSql(
      `alter table "content_parts" add constraint "content_parts_kind_check" check ("kind" in ('paragraph', 'list_item'));`,
    );
  }
}
