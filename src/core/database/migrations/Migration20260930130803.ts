import { Migration } from '@mikro-orm/migrations';

export class Migration20260930130803 extends Migration {
  override name = 'Migration20260930130803';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "users" add "native_lang" text not null default 'uk';`,
    );
    this.addSql(
      `alter table "users" add constraint "users_native_lang_check" check ("native_lang" in ('uk'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "users" drop constraint "users_native_lang_check";`,
    );
    this.addSql(`alter table "users" drop column "native_lang";`);
  }
}
