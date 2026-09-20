import { Migration } from '@mikro-orm/migrations';

export class Migration20260920130954 extends Migration {
  override name = 'Migration20260920130954';

  override up(): void | Promise<void> {
    // No FK existed before, so drop orphans top-down (parents first) so the
    // constraints below can be added.
    this.addSql(
      `delete from "exercises" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "post_parts" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "post_pipeline_runs" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "post_publications" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "post_reads" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "sentences" where "post_id" not in (select "id" from "posts");`,
    );
    this.addSql(
      `delete from "sentences" where "post_part_id" not in (select "id" from "post_parts");`,
    );
    this.addSql(
      `delete from "grammar_matches" where "sentence_id" not in (select "id" from "sentences");`,
    );
    this.addSql(
      `delete from "sentence_tokens" where "sentence_id" not in (select "id" from "sentences");`,
    );

    this.addSql(
      `alter table "exercises" add constraint "exercises_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "post_parts" add constraint "post_parts_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "post_publications" add constraint "post_publications_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "post_reads" add constraint "post_reads_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "sentences" add constraint "sentences_post_id_foreign" foreign key ("post_id") references "posts" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "sentences" add constraint "sentences_post_part_id_foreign" foreign key ("post_part_id") references "post_parts" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "grammar_matches" add constraint "grammar_matches_sentence_id_foreign" foreign key ("sentence_id") references "sentences" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "sentence_tokens" add constraint "sentence_tokens_sentence_id_foreign" foreign key ("sentence_id") references "sentences" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "exercises" drop constraint "exercises_post_id_foreign";`,
    );

    this.addSql(
      `alter table "grammar_matches" drop constraint "grammar_matches_sentence_id_foreign";`,
    );

    this.addSql(
      `alter table "post_parts" drop constraint "post_parts_post_id_foreign";`,
    );

    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_post_id_foreign";`,
    );

    this.addSql(
      `alter table "post_publications" drop constraint "post_publications_post_id_foreign";`,
    );

    this.addSql(
      `alter table "post_reads" drop constraint "post_reads_post_id_foreign";`,
    );

    this.addSql(
      `alter table "sentence_tokens" drop constraint "sentence_tokens_sentence_id_foreign";`,
    );

    this.addSql(
      `alter table "sentences" drop constraint "sentences_post_id_foreign";`,
    );
    this.addSql(
      `alter table "sentences" drop constraint "sentences_post_part_id_foreign";`,
    );
  }
}
