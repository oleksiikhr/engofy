import { Migration } from '@mikro-orm/migrations';

export class Migration20260824192359 extends Migration {
  override name = 'Migration20260824192359';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "auth_challenges" ("id" uuid not null, "email" text not null, "otp_hash" text not null, "attempts" smallint not null default 0, "expires_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "auth_challenges" add constraint "auth_challenges_email_unique" unique ("email");`,
    );

    this.addSql(
      `create table "auth_sessions" ("id" uuid not null, "token_hash" text not null, "user_id" uuid not null, "expires_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "auth_sessions" add constraint "auth_sessions_token_hash_unique" unique ("token_hash");`,
    );
    this.addSql(
      `create index "auth_sessions_user_id_index" on "auth_sessions" ("user_id");`,
    );

    this.addSql(
      `create table "contents" ("id" uuid not null, "source_format" text not null, "source_raw_text" text not null, "source_link" text null, "title" text null, "type" text not null default 'post', "slug" text null, "short_id" text not null, "status" text not null default 'pending', "published_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "contents" add constraint "contents_short_id_unique" unique ("short_id");`,
    );

    this.addSql(
      `create table "content_parts" ("id" uuid not null, "content_id" uuid not null, "block_index" int not null, "kind" text not null, "body" jsonb not null, "annotated_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "content_parts" add constraint "content_parts_content_id_block_index_unique" unique ("content_id", "block_index");`,
    );

    this.addSql(
      `create table "content_pipeline_runs" ("id" uuid not null, "content_id" uuid not null, "stage" text not null, "status" text not null default 'pending', "completed_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "content_pipeline_runs" add constraint "content_pipeline_runs_content_id_stage_unique" unique ("content_id", "stage");`,
    );

    this.addSql(
      `create table "phrases" ("id" uuid not null, "phrase_text" text not null, "type" text null, "definition" text null, "example_sentence" text null, "cefr_level" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "phrases_phrase_text_unique_idx" on "phrases" (lower("phrase_text"));`,
    );

    this.addSql(
      `create table "users" ("id" uuid not null, "email" text not null, "google_sub" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "users" add constraint "users_email_unique" unique ("email");`,
    );
    this.addSql(
      `alter table "users" add constraint "users_google_sub_unique" unique ("google_sub");`,
    );

    this.addSql(
      `create table "words" ("id" uuid not null, "lemma" text not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "words_lemma_unique_idx" on "words" (lower("lemma"));`,
    );

    this.addSql(
      `create table "word_definitions" ("id" uuid not null, "word_id" uuid not null, "pos" text not null, "definition" text null, "phonetic" text null, "cefr_level" text not null, "example_sentence" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_word_id_pos_unique" unique ("word_id", "pos");`,
    );

    this.addSql(
      `alter table "contents" add constraint "contents_type_check" check ("type" in ('post', 'article', 'book', 'quote', 'comment'));`,
    );
    this.addSql(
      `alter table "contents" add constraint "contents_status_check" check ("status" in ('pending', 'annotating', 'annotated', 'failed'));`,
    );
    this.addSql(
      `alter table "contents" add constraint "contents_source_format_check" check ("source_format" in ('text', 'markdown', 'html'));`,
    );

    this.addSql(
      `alter table "content_parts" add constraint "content_parts_kind_check" check ("kind" in ('paragraph', 'list'));`,
    );

    this.addSql(
      `alter table "content_pipeline_runs" add constraint "content_pipeline_runs_stage_check" check ("stage" in ('annotation', 'grammar_tagging', 'comprehension_questions', 'conversation_kit'));`,
    );
    this.addSql(
      `alter table "content_pipeline_runs" add constraint "content_pipeline_runs_status_check" check ("status" in ('pending', 'completed', 'failed'));`,
    );

    this.addSql(
      `alter table "phrases" add constraint "phrases_type_check" check ("type" in ('phrasal_verb', 'idiom', 'collocation', 'other'));`,
    );
    this.addSql(
      `alter table "phrases" add constraint "phrases_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_pos_check" check ("pos" in ('noun', 'proper_noun', 'verb', 'auxiliary', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'particle', 'other'));`,
    );
    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "auth_challenges" cascade;`);
    this.addSql(`drop table if exists "auth_sessions" cascade;`);
    this.addSql(`drop table if exists "contents" cascade;`);
    this.addSql(`drop table if exists "content_parts" cascade;`);
    this.addSql(`drop table if exists "content_pipeline_runs" cascade;`);
    this.addSql(`drop table if exists "phrases" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "words" cascade;`);
    this.addSql(`drop table if exists "word_definitions" cascade;`);
  }
}
