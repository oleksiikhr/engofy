import { Migration } from '@mikro-orm/migrations';

export class Migration20260829132257 extends Migration {
  override name = 'Migration20260829132257';

  override up(): void | Promise<void> {
    this.addSql(`alter table "grammar_usage_points" add "egp_index" int null;`);
    this.addSql(
      `alter table "grammar_usage_points" add constraint "grammar_usage_points_egp_index_unique" unique ("egp_index");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" drop constraint "grammar_usage_points_egp_index_unique";`,
    );
    this.addSql(`alter table "grammar_usage_points" drop column "egp_index";`);
  }
}
