import { Migration } from '@mikro-orm/migrations';

export class Migration20260920193453 extends Migration {
  override name = 'Migration20260920193453';

  override up(): void | Promise<void> {
    this.addSql(`alter table "posts" add "topic" text null;`);
    this.addSql(
      `alter table "posts" add constraint "posts_topic_check" check ("topic" in ('daily_life', 'food', 'travel', 'work', 'technology', 'health', 'nature', 'culture', 'society', 'science'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop constraint "posts_topic_check";`);
    this.addSql(`alter table "posts" drop column "topic";`);
  }
}
