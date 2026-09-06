import { Migration } from '@mikro-orm/migrations';

export class Migration20260829153800 extends Migration {
  override name = 'Migration20260829153800';

  override up(): void | Promise<void> {
    this.addSql(`alter table "posts" drop constraint "posts_status_check";`);
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check ("status" in ('pending', 'annotating', 'annotated', 'published', 'failed'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop constraint "posts_status_check";`);
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check ("status" in ('pending', 'annotating', 'annotated', 'failed'));`,
    );
  }
}
