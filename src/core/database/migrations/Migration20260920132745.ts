import { Migration } from '@mikro-orm/migrations';

export class Migration20260920132745 extends Migration {
  override name = 'Migration20260920132745';

  override up(): void | Promise<void> {
    // No FK existed before, so clear orphans (parents first) so the constraints
    // below can be added. Post-owned tokens and the daily plan's optional grammar
    // point are nulled instead of deleted.
    this.addSql(
      `delete from "grammar_constructions" where "category_id" not in (select "id" from "grammar_categories");`,
    );
    this.addSql(
      `delete from "grammar_usage_points" where "construction_id" not in (select "id" from "grammar_constructions");`,
    );
    this.addSql(
      `delete from "word_definitions" where "word_id" not in (select "id" from "words");`,
    );
    this.addSql(
      `delete from "grammar_matches" where "grammar_usage_point_id" not in (select "id" from "grammar_usage_points");`,
    );
    this.addSql(
      `delete from "user_skill_progress" where "construction_id" not in (select "id" from "grammar_constructions");`,
    );
    this.addSql(
      `update "daily_plans" set "grammar_usage_point_id" = null where "grammar_usage_point_id" is not null and "grammar_usage_point_id" not in (select "id" from "grammar_usage_points");`,
    );
    this.addSql(
      `delete from "learning_cards" where "word_definition_id" is not null and "word_definition_id" not in (select "id" from "word_definitions");`,
    );
    this.addSql(
      `delete from "learning_dispositions" where "word_definition_id" is not null and "word_definition_id" not in (select "id" from "word_definitions");`,
    );
    this.addSql(
      `delete from "learning_cards" where "phrase_id" is not null and "phrase_id" not in (select "id" from "phrases");`,
    );
    this.addSql(
      `delete from "learning_dispositions" where "phrase_id" is not null and "phrase_id" not in (select "id" from "phrases");`,
    );
    this.addSql(
      `delete from "learning_cards" where "grammar_usage_point_id" is not null and "grammar_usage_point_id" not in (select "id" from "grammar_usage_points");`,
    );
    this.addSql(
      `delete from "learning_dispositions" where "grammar_usage_point_id" is not null and "grammar_usage_point_id" not in (select "id" from "grammar_usage_points");`,
    );
    this.addSql(
      `update "sentence_tokens" set "phrasal_verb_group_id" = null where "phrasal_verb_group_id" is not null and "phrasal_verb_group_id" not in (select "id" from "phrases");`,
    );
    this.addSql(
      `update "sentence_tokens" set "word_id" = null where "word_id" is not null and "word_id" not in (select "id" from "words");`,
    );
    this.addSql(
      `update "sentence_tokens" set "phrase_id" = null where "phrase_id" is not null and "phrase_id" not in (select "id" from "phrases");`,
    );

    this.addSql(
      `alter table "grammar_constructions" add constraint "grammar_constructions_category_id_foreign" foreign key ("category_id") references "grammar_categories" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "grammar_usage_points" add constraint "grammar_usage_points_construction_id_foreign" foreign key ("construction_id") references "grammar_constructions" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "grammar_matches" add constraint "grammar_matches_grammar_usage_point_id_foreign" foreign key ("grammar_usage_point_id") references "grammar_usage_points" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "daily_plans" add constraint "daily_plans_grammar_usage_point_id_foreign" foreign key ("grammar_usage_point_id") references "grammar_usage_points" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "user_skill_progress" add constraint "user_skill_progress_construction_id_foreign" foreign key ("construction_id") references "grammar_constructions" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_phrasal_verb_group_id_foreign" foreign key ("phrasal_verb_group_id") references "phrases" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_word_id_foreign" foreign key ("word_id") references "words" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_phrase_id_foreign" foreign key ("phrase_id") references "phrases" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "word_definitions" add constraint "word_definitions_word_id_foreign" foreign key ("word_id") references "words" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_word_definition_id_foreign" foreign key ("word_definition_id") references "word_definitions" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_phrase_id_foreign" foreign key ("phrase_id") references "phrases" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_grammar_usage_point_id_foreign" foreign key ("grammar_usage_point_id") references "grammar_usage_points" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_word_definition_id_foreign" foreign key ("word_definition_id") references "word_definitions" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_phrase_id_foreign" foreign key ("phrase_id") references "phrases" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "learning_cards" add constraint "learning_cards_grammar_usage_point_id_foreign" foreign key ("grammar_usage_point_id") references "grammar_usage_points" ("id") on delete restrict;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "daily_plans" drop constraint "daily_plans_grammar_usage_point_id_foreign";`,
    );

    this.addSql(
      `alter table "grammar_constructions" drop constraint "grammar_constructions_category_id_foreign";`,
    );

    this.addSql(
      `alter table "grammar_matches" drop constraint "grammar_matches_grammar_usage_point_id_foreign";`,
    );

    this.addSql(
      `alter table "grammar_usage_points" drop constraint "grammar_usage_points_construction_id_foreign";`,
    );

    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_word_definition_id_foreign";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_phrase_id_foreign";`,
    );
    this.addSql(
      `alter table "learning_cards" drop constraint "learning_cards_grammar_usage_point_id_foreign";`,
    );

    this.addSql(
      `alter table "learning_dispositions" drop constraint "learning_dispositions_word_definition_id_foreign";`,
    );
    this.addSql(
      `alter table "learning_dispositions" drop constraint "learning_dispositions_phrase_id_foreign";`,
    );
    this.addSql(
      `alter table "learning_dispositions" drop constraint "learning_dispositions_grammar_usage_point_id_foreign";`,
    );

    this.addSql(
      `alter table "sentence_tokens" drop constraint "sentence_tokens_phrasal_verb_group_id_foreign";`,
    );
    this.addSql(
      `alter table "sentence_tokens" drop constraint "sentence_tokens_word_id_foreign";`,
    );
    this.addSql(
      `alter table "sentence_tokens" drop constraint "sentence_tokens_phrase_id_foreign";`,
    );

    this.addSql(
      `alter table "user_skill_progress" drop constraint "user_skill_progress_construction_id_foreign";`,
    );

    this.addSql(
      `alter table "word_definitions" drop constraint "word_definitions_word_id_foreign";`,
    );
  }
}
