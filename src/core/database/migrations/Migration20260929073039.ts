import { Migration } from '@mikro-orm/migrations';

export class Migration20260929073039 extends Migration {
  override name = 'Migration20260929073039';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "grammar_page_lex_blocks" ("id" uuid not null, "construction_id" uuid not null, "text_hash" text not null, "spans" jsonb not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "grammar_page_lex_blocks" add constraint "grammar_page_lex_blocks_construction_id_text_hash_unique" unique ("construction_id", "text_hash");`,
    );

    this.addSql(
      `alter table "grammar_page_lex_blocks" add constraint "grammar_page_lex_blocks_construction_id_foreign" foreign key ("construction_id") references "grammar_constructions" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "grammar_page_lex_blocks" cascade;`);
  }
}
