import { Migration } from '@mikro-orm/migrations';

export class Migration20260912095251 extends Migration {
  override name = 'Migration20260912095251';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'enrichment', 'ai_exercises', 'publish'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'ai_exercises', 'publish'));`,
    );
  }
}
