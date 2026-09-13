import { Migration } from '@mikro-orm/migrations';

// learning-foundation slice 1: the learner's own self-reported CEFR level
// (NOT NULL, defaults to 'A1' so existing rows backfill), distinct from the
// derived per-card CEFR breakdown already computed at read time in
// `GetProfileHandler`.
export class Migration20260913102857 extends Migration {
  override name = 'Migration20260913102857';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "users" add column "cefr_level" text not null default 'A1';`,
    );
    this.addSql(
      `alter table "users" add constraint "users_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "users" drop constraint "users_cefr_level_check";`,
    );
    this.addSql(`alter table "users" drop column "cefr_level";`);
  }
}
