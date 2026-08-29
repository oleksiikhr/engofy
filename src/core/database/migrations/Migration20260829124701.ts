import { Migration } from '@mikro-orm/migrations';

export class Migration20260829124701 extends Migration {
  override name = 'Migration20260829124701';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "exercises" ("id" uuid not null, "post_id" uuid not null, "type" text not null, "payload" jsonb not null, "source" text not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "exercises_post_id_index" on "exercises" ("post_id");`,
    );

    this.addSql(
      `create table "grammar_categories" ("id" uuid not null, "name" text not null, "sort_order" int not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "grammar_categories" add constraint "grammar_categories_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "grammar_constructions" ("id" uuid not null, "category_id" uuid not null, "name" text not null, "slug" text not null, "cheat_sheet_content" text null, "sort_order" int not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "grammar_constructions_category_id_index" on "grammar_constructions" ("category_id");`,
    );
    this.addSql(
      `alter table "grammar_constructions" add constraint "grammar_constructions_slug_unique" unique ("slug");`,
    );

    this.addSql(
      `create table "grammar_matches" ("id" uuid not null, "sentence_id" uuid not null, "grammar_usage_point_id" uuid not null, "confidence" real null, "token_start" int not null, "token_end" int not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "grammar_matches_sentence_id_index" on "grammar_matches" ("sentence_id");`,
    );
    this.addSql(
      `create index "grammar_matches_grammar_usage_point_id_index" on "grammar_matches" ("grammar_usage_point_id");`,
    );

    this.addSql(
      `create table "grammar_usage_points" ("id" uuid not null, "construction_id" uuid not null, "cefr_level" text not null, "guideword" text not null, "can_do_statement" text not null, "example_text" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "grammar_usage_points_construction_id_index" on "grammar_usage_points" ("construction_id");`,
    );

    this.addSql(
      `create table "learning_cards" ("id" uuid not null, "user_id" uuid not null, "word_id" uuid null, "phrase_id" uuid null, "grammar_usage_point_id" uuid null, "due" timestamp with time zone not null, "stability" double precision not null, "difficulty" double precision not null, "elapsed_days" int not null, "scheduled_days" int not null, "reps" int not null, "lapses" int not null, "state" text not null default 'new', "last_review" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "learning_cards_user_id_index" on "learning_cards" ("user_id");`,
    );
    this.addSql(
      `create index "learning_cards_due_index" on "learning_cards" ("due");`,
    );

    this.addSql(
      `create table "post_publications" ("id" uuid not null, "post_id" uuid not null, "platform" text not null, "external_id" text null, "status" text not null default 'pending', "published_at" timestamp with time zone null, "error_message" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "post_publications_post_id_index" on "post_publications" ("post_id");`,
    );
    this.addSql(
      `alter table "post_publications" add constraint "post_publications_post_id_platform_unique" unique ("post_id", "platform");`,
    );

    this.addSql(
      `create table "review_logs" ("id" uuid not null, "card_id" uuid not null, "rating" text not null, "reviewed_at" timestamp with time zone not null, "elapsed_days" int not null, "scheduled_days" int not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "review_logs_card_id_index" on "review_logs" ("card_id");`,
    );

    this.addSql(
      `create table "telegram_updates" ("id" uuid not null, "telegram_message_id" bigint not null, "raw_payload" jsonb not null, "processed" boolean not null default false, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "telegram_updates" add constraint "telegram_updates_telegram_message_id_unique" unique ("telegram_message_id");`,
    );

    this.addSql(
      `create table "user_skill_progress" ("id" uuid not null, "user_id" uuid not null, "construction_id" uuid not null, "mastery_score" smallint not null default 0, "correct_streak" int not null default 0, "total_attempts" int not null default 0, "correct_attempts" int not null default 0, "unlocked_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "user_skill_progress_user_id_index" on "user_skill_progress" ("user_id");`,
    );
    this.addSql(
      `alter table "user_skill_progress" add constraint "user_skill_progress_user_id_construction_id_unique" unique ("user_id", "construction_id");`,
    );

    this.addSql(
      `alter table "exercises" add constraint "exercises_type_check" check ("type" in ('fill_blank', 'find_error', 'multiple_choice', 'comprehension', 'reorder'));`,
    );
    this.addSql(
      `alter table "exercises" add constraint "exercises_source_check" check ("source" in ('spacy', 'ai'));`,
    );

    this.addSql(
      `alter table "grammar_usage_points" add constraint "grammar_usage_points_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_exactly_one_target" check ((word_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_state_check" check ("state" in ('new', 'learning', 'review', 'relearning'));`,
    );

    this.addSql(
      `alter table "post_publications" add constraint "post_publications_platform_check" check ("platform" in ('telegram', 'twitter', 'facebook', 'ios_push', 'android_push'));`,
    );
    this.addSql(
      `alter table "post_publications" add constraint "post_publications_status_check" check ("status" in ('pending', 'published', 'failed'));`,
    );

    this.addSql(
      `alter table "review_logs" add constraint "review_logs_rating_check" check ("rating" in ('again', 'hard', 'good', 'easy'));`,
    );

    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add "started_at" timestamp with time zone null, add "error_message" text null, add "retry_count" int not null default 0;`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('fetch', 'spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'ai_exercises', 'publish'));`,
    );

    this.addSql(`alter table "words" add "frequency_rank" int null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "exercises" cascade;`);
    this.addSql(`drop table if exists "grammar_categories" cascade;`);
    this.addSql(`drop table if exists "grammar_constructions" cascade;`);
    this.addSql(`drop table if exists "grammar_matches" cascade;`);
    this.addSql(`drop table if exists "grammar_usage_points" cascade;`);
    this.addSql(`drop table if exists "learning_cards" cascade;`);
    this.addSql(`drop table if exists "post_publications" cascade;`);
    this.addSql(`drop table if exists "review_logs" cascade;`);
    this.addSql(`drop table if exists "telegram_updates" cascade;`);
    this.addSql(`drop table if exists "user_skill_progress" cascade;`);

    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" drop column "started_at", drop column "error_message", drop column "retry_count";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('annotation', 'grammar_tagging', 'comprehension_questions', 'conversation_kit'));`,
    );

    this.addSql(`alter table "words" drop column "frequency_rank";`);
  }
}
