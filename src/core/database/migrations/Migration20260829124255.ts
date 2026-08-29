import { Migration } from '@mikro-orm/migrations';

export class Migration20260829124255 extends Migration {
  override name = 'Migration20260829124255';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "sentences" ("id" uuid not null, "post_id" uuid not null, "post_part_id" uuid not null, "unit_index" int not null default 0, "position" int not null, "raw_text" text not null, "char_start" int not null, "char_end" int not null, "cefr_level" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "sentences_post_id_index" on "sentences" ("post_id");`,
    );
    this.addSql(
      `create index "sentences_post_part_id_index" on "sentences" ("post_part_id");`,
    );
    this.addSql(
      `alter table "sentences" add constraint "sentences_post_part_id_unit_index_position_unique" unique ("post_part_id", "unit_index", "position");`,
    );

    this.addSql(
      `create table "sentence_tokens" ("id" uuid not null, "sentence_id" uuid not null, "position" int not null, "text" text not null, "char_start" int not null, "char_end" int not null, "lemma" text not null, "pos" text not null, "tag" text not null, "dep" text not null, "head_position" int null, "morph" jsonb not null, "phrasal_verb_group_id" uuid null, "is_gerund" boolean not null default false, "is_idiom_part" boolean not null default false, "word_id" uuid null, "phrase_id" uuid null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "sentence_tokens_sentence_id_index" on "sentence_tokens" ("sentence_id");`,
    );
    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_sentence_id_position_unique" unique ("sentence_id", "position");`,
    );

    this.addSql(
      `alter table "sentences" add constraint "sentences_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "sentences" cascade;`);
    this.addSql(`drop table if exists "sentence_tokens" cascade;`);
  }
}
