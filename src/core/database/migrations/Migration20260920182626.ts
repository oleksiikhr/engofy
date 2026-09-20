import { Migration } from '@mikro-orm/migrations';

export class Migration20260920182626 extends Migration {
  override name = 'Migration20260920182626';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" add "learner_explanation" text null, add "learner_examples" jsonb null;`,
    );

    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'enrichment', 'grammar_enrichment', 'ai_exercises', 'publish'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "grammar_usage_points" drop column "learner_explanation", drop column "learner_examples";`,
    );

    this.addSql(
      `alter table "post_pipeline_runs" drop constraint "post_pipeline_runs_stage_check";`,
    );
    this.addSql(
      `alter table "post_pipeline_runs" add constraint "post_pipeline_runs_stage_check" check ("stage" in ('spacy_parse', 'annotation', 'ai_complexity', 'ai_grammar', 'enrichment', 'ai_exercises', 'publish'));`,
    );
  }
}
