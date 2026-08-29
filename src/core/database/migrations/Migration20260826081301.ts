import { Migration } from '@mikro-orm/migrations';

export class Migration20260826081301 extends Migration {
  override name = 'Migration20260826081301';

  override up(): void | Promise<void> {
    this.addSql(`alter table "contents" rename to "posts";`);
    this.addSql(
      `alter table "posts" rename constraint "contents_short_id_unique" to "posts_short_id_unique";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "contents_type_check" to "posts_type_check";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "contents_status_check" to "posts_status_check";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "contents_source_format_check" to "posts_source_format_check";`,
    );

    this.addSql(`alter table "content_parts" rename to "post_parts";`);
    this.addSql(
      `alter table "post_parts" rename column "content_id" to "post_id";`,
    );
    this.addSql(
      `alter table "post_parts" rename constraint "content_parts_content_id_block_index_unique" to "post_parts_post_id_block_index_unique";`,
    );
    this.addSql(
      `alter table "post_parts" rename constraint "content_parts_kind_check" to "post_parts_kind_check";`,
    );

    this.addSql(
      `alter table "content_pipeline_runs" rename to "post_pipeline_runs";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename column "content_id" to "post_id";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "content_pipeline_runs_content_id_stage_unique" to "post_pipeline_runs_post_id_stage_unique";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "content_pipeline_runs_stage_check" to "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "content_pipeline_runs_status_check" to "post_pipeline_runs_status_check";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "post_pipeline_runs_status_check" to "content_pipeline_runs_status_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "post_pipeline_runs_stage_check" to "content_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename constraint "post_pipeline_runs_post_id_stage_unique" to "content_pipeline_runs_content_id_stage_unique";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename column "post_id" to "content_id";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" rename to "content_pipeline_runs";`,
    );

    this.addSql(
      `alter table "post_parts" rename constraint "post_parts_kind_check" to "content_parts_kind_check";`,
    );
    this.addSql(
      `alter table "post_parts" rename constraint "post_parts_post_id_block_index_unique" to "content_parts_content_id_block_index_unique";`,
    );
    this.addSql(
      `alter table "post_parts" rename column "post_id" to "content_id";`,
    );
    this.addSql(`alter table "post_parts" rename to "content_parts";`);

    this.addSql(
      `alter table "posts" rename constraint "posts_source_format_check" to "contents_source_format_check";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "posts_status_check" to "contents_status_check";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "posts_type_check" to "contents_type_check";`,
    );
    this.addSql(
      `alter table "posts" rename constraint "posts_short_id_unique" to "contents_short_id_unique";`,
    );
    this.addSql(`alter table "posts" rename to "contents";`);
  }
}
