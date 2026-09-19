import { Migration } from '@mikro-orm/migrations';

export class Migration20260919151755 extends Migration {
  override name = 'Migration20260919151755';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "account_deletion_requests" ("id" uuid not null, "user_id" uuid not null, "requested_at" timestamp with time zone not null, "cancel_token_hash" text not null, "cancelled_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "account_deletion_requests_user_id_index" on "account_deletion_requests" ("user_id");`,
    );
    this.addSql(
      `alter table "account_deletion_requests" add constraint "account_deletion_requests_cancel_token_hash_unique" unique ("cancel_token_hash");`,
    );

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
      `create table "daily_plans" ("id" uuid not null, "user_id" uuid not null, "plan_date" date not null, "post_id" uuid not null, "grammar_usage_point_id" uuid null, "completed_at" timestamp with time zone null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "daily_plans" add constraint "daily_plans_user_id_plan_date_unique" unique ("user_id", "plan_date");`,
    );

    this.addSql(
      `create table "exercises" ("id" uuid not null, "post_id" uuid not null, "type" text not null, "payload" jsonb not null, "source" text not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "exercises_post_id_index" on "exercises" ("post_id");`,
    );
    this.addSql(
      `alter table "exercises" add constraint "exercises_type_check" check ("type" in ('fill_blank', 'find_error', 'multiple_choice', 'grammar_contrastive', 'reorder'));`,
    );
    this.addSql(
      `alter table "exercises" add constraint "exercises_source_check" check ("source" in ('spacy', 'ai'));`,
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
      `create index "grammar_matches_grammar_usage_point_id_index" on "grammar_matches" ("grammar_usage_point_id");`,
    );
    this.addSql(
      `alter table "grammar_matches" add constraint "grammar_matches_sentence_id_grammar_usage_point_i_05997_unique" unique ("sentence_id", "grammar_usage_point_id", "token_start", "token_end");`,
    );

    this.addSql(
      `create table "grammar_usage_points" ("id" uuid not null, "construction_id" uuid not null, "egp_index" int null, "cefr_level" text not null, "guideword" text not null, "can_do_statement" text not null, "example_text" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "grammar_usage_points_construction_id_index" on "grammar_usage_points" ("construction_id");`,
    );
    this.addSql(
      `alter table "grammar_usage_points" add constraint "grammar_usage_points_egp_index_unique" unique ("egp_index");`,
    );
    this.addSql(
      `alter table "grammar_usage_points" add constraint "grammar_usage_points_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `create table "learning_cards" ("id" uuid not null, "user_id" uuid not null, "word_definition_id" uuid null, "phrase_id" uuid null, "grammar_usage_point_id" uuid null, "due" timestamp with time zone not null, "stability" double precision not null, "difficulty" double precision not null, "elapsed_days" int not null, "scheduled_days" int not null, "reps" int not null, "lapses" int not null, "state" text not null default 'new', "last_review" timestamp with time zone null, "archived_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "learning_cards_user_id_due_index" on "learning_cards" ("user_id", "due");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_grammar_usage_point_id_unique" unique ("user_id", "grammar_usage_point_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_phrase_id_unique" unique ("user_id", "phrase_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_user_id_word_definition_id_unique" unique ("user_id", "word_definition_id");`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_exactly_one_target" check ((word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_state_check" check ("state" in ('new', 'learning', 'review', 'relearning'));`,
    );

    this.addSql(
      `create table "learning_dispositions" ("id" uuid not null, "user_id" uuid not null, "word_definition_id" uuid null, "phrase_id" uuid null, "grammar_usage_point_id" uuid null, "disposition" text not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_grammar_usage_point_id_unique" unique ("user_id", "grammar_usage_point_id");`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_phrase_id_unique" unique ("user_id", "phrase_id");`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_word_definition_id_unique" unique ("user_id", "word_definition_id");`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_exactly_one_target" check ((word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_disposition_check" check ("disposition" in ('known', 'skipped'));`,
    );

    this.addSql(
      `create table "phrases" ("id" uuid not null, "phrase_text" text not null, "type" text null, "definition" text null, "example_sentence" text null, "cefr_level" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "phrases_phrase_text_unique_idx" on "phrases" (lower("phrase_text"));`,
    );
    this.addSql(
      `alter table "phrases" add constraint "phrases_type_check" check ("type" in ('phrasal_verb', 'idiom', 'collocation', 'other'));`,
    );
    this.addSql(
      `alter table "phrases" add constraint "phrases_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `create table "posts" ("id" uuid not null, "source_format" text not null, "source_type" text not null default 'original', "source_raw_text" text not null, "source_link" text null, "source_attribution_text" text not null default 'Original content', "title" text null, "type" text not null default 'post', "slug" text null, "short_id" text not null, "status" text not null default 'pending', "cefr_level" text null, "published_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_short_id_unique" unique ("short_id");`,
    );
    this.addSql(
      `create index "posts_status_published_at_id_index" on "posts" ("status", "published_at", "id");`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_type_check" check ("type" in ('post', 'article', 'book', 'quote', 'comment'));`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check ("status" in ('pending', 'processing', 'published', 'failed'));`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_source_format_check" check ("source_format" in ('text', 'markdown', 'html'));`,
    );
    this.addSql(
      `alter table "posts" add constraint "posts_source_type_check" check ("source_type" in ('original', 'excerpt', 'reddit_comment', 'news_snippet'));`,
    );

    this.addSql(
      `create table "post_parts" ("id" uuid not null, "post_id" uuid not null, "block_index" int not null, "kind" text not null, "body" jsonb not null, "annotated_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "post_parts" add constraint "post_parts_post_id_block_index_unique" unique ("post_id", "block_index");`,
    );
    this.addSql(
      `alter table "post_parts" add constraint "post_parts_kind_check" check ("kind" in ('paragraph', 'list'));`,
    );

    this.addSql(
      `create table "post_pipeline_runs" ("id" uuid not null, "post_id" uuid not null, "stage" text not null, "status" text not null default 'pending', "started_at" timestamp with time zone null, "completed_at" timestamp with time zone null, "error_message" text null, "retry_count" int not null default 0, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_post_id_stage_unique" unique ("post_id", "stage");`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'enrichment', 'ai_exercises', 'publish'));`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_status_check" check ("status" in ('pending', 'completed', 'failed'));`,
    );

    this.addSql(
      `create table "post_publications" ("id" uuid not null, "post_id" uuid not null, "platform" text not null, "external_id" text null, "status" text not null default 'pending', "published_at" timestamp with time zone null, "error_message" text null, "retry_count" int not null default 0, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "post_publications" add constraint "post_publications_post_id_platform_unique" unique ("post_id", "platform");`,
    );
    this.addSql(
      `alter table "post_publications" add constraint "post_publications_platform_check" check ("platform" in ('telegram', 'twitter', 'facebook', 'ios_push', 'android_push'));`,
    );
    this.addSql(
      `alter table "post_publications" add constraint "post_publications_status_check" check ("status" in ('pending', 'published', 'failed'));`,
    );

    this.addSql(
      `create table "post_reads" ("id" uuid not null, "user_id" uuid not null, "post_id" uuid not null, "read_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "post_reads" add constraint "post_reads_user_id_post_id_unique" unique ("user_id", "post_id");`,
    );

    this.addSql(
      `create table "review_logs" ("id" uuid not null, "card_id" uuid not null, "rating" text not null, "reviewed_at" timestamp with time zone not null, "elapsed_days" int not null, "scheduled_days" int not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "review_logs_card_id_index" on "review_logs" ("card_id");`,
    );
    this.addSql(
      `alter table "review_logs" add constraint "review_logs_rating_check" check ("rating" in ('again', 'hard', 'good', 'easy'));`,
    );

    this.addSql(
      `create table "sentences" ("id" uuid not null, "post_id" uuid not null, "post_part_id" uuid not null, "unit_index" int not null default 0, "position" int not null, "raw_text" text not null, "char_start" int not null, "char_end" int not null, "cefr_level" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "sentences_post_id_index" on "sentences" ("post_id");`,
    );
    this.addSql(
      `alter table "sentences" add constraint "sentences_post_part_id_unit_index_position_unique" unique ("post_part_id", "unit_index", "position");`,
    );
    this.addSql(
      `alter table "sentences" add constraint "sentences_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `create table "sentence_tokens" ("id" uuid not null, "sentence_id" uuid not null, "position" int not null, "text" text not null, "char_start" int not null, "char_end" int not null, "lemma" text not null, "pos" text not null, "tag" text not null, "dep" text not null, "head_position" int null, "morph" jsonb not null, "phrasal_verb_group_id" uuid null, "is_gerund" boolean not null default false, "is_idiom_part" boolean not null default false, "word_id" uuid null, "phrase_id" uuid null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "sentence_tokens_word_id_index" on "sentence_tokens" ("word_id");`,
    );
    this.addSql(
      `create index "sentence_tokens_phrase_id_index" on "sentence_tokens" ("phrase_id");`,
    );
    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_sentence_id_position_unique" unique ("sentence_id", "position");`,
    );

    this.addSql(
      `create table "subscriptions" ("id" uuid not null, "user_id" uuid not null, "plan" text not null, "status" text not null default 'active', "started_at" timestamp with time zone not null, "current_period_end" timestamp with time zone not null, "is_mock_payment" boolean not null default true, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "subscriptions_user_id_index" on "subscriptions" ("user_id");`,
    );
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_plan_check" check ("plan" in ('free', 'premium'));`,
    );
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_status_check" check ("status" in ('active'));`,
    );

    this.addSql(
      `create table "telegram_updates" ("id" uuid not null, "update_id" bigint not null, "raw_payload" jsonb not null, "processed" boolean not null default false, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "telegram_updates" add constraint "telegram_updates_update_id_unique" unique ("update_id");`,
    );

    this.addSql(
      `create table "users" ("id" uuid not null, "email" text not null, "google_sub" text null, "cefr_level" text not null default 'A1', "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "users" add constraint "users_email_unique" unique ("email");`,
    );
    this.addSql(
      `alter table "users" add constraint "users_google_sub_unique" unique ("google_sub");`,
    );
    this.addSql(
      `alter table "users" add constraint "users_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );

    this.addSql(
      `create table "user_skill_progress" ("id" uuid not null, "user_id" uuid not null, "construction_id" uuid not null, "correct_streak" int not null default 0, "total_attempts" int not null default 0, "correct_attempts" int not null default 0, "unlocked_at" timestamp with time zone null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "user_skill_progress" add constraint "user_skill_progress_user_id_construction_id_unique" unique ("user_id", "construction_id");`,
    );

    this.addSql(
      `create table "words" ("id" uuid not null, "lemma" text not null, "frequency_rank" int null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "words_lemma_unique_idx" on "words" (lower("lemma"));`,
    );

    this.addSql(
      `create table "word_definitions" ("id" uuid not null, "word_id" uuid not null, "pos" text not null, "definition" text null, "phonetic" text null, "cefr_level" text null, "example_sentence" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_word_id_pos_unique" unique ("word_id", "pos");`,
    );
    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_pos_check" check ("pos" in ('noun', 'proper_noun', 'verb', 'auxiliary', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'particle', 'other'));`,
    );
    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_cefr_level_check" check ("cefr_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));`,
    );
  }
}
