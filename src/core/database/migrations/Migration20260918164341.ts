import { Migration } from '@mikro-orm/migrations';

export class Migration20260918164341 extends Migration {
  override name = 'Migration20260918164341';

  override up(): void | Promise<void> {
    this.addSql(
      `create index "posts_status_published_at_id_index" on "posts" ("status", "published_at", "id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "posts_status_published_at_id_index";`);
  }
}
