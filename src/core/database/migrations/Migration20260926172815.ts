import { Migration } from '@mikro-orm/migrations';

export class Migration20260926172815 extends Migration {
  override name = 'Migration20260926172815';

  override up(): void | Promise<void> {
    this.addSql(`alter table "posts" add "meta_description" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "posts" drop column "meta_description";`);
  }
}
