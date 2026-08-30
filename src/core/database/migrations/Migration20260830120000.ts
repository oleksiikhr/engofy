import { Migration } from '@mikro-orm/migrations';

// Batch C tail: `PostPipelineStage.Fetch` was removed (ingest takes pasted text
// synchronously, there is no fetch stage). Drop the now-unused `'fetch'`
// literal from the CHECK so entities and schema agree (D7 / D12).
export class Migration20260830120000 extends Migration {
  override name = 'Migration20260830120000';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'ai_exercises', 'publish'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('fetch', 'spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'ai_exercises', 'publish'));`,
    );
  }
}
