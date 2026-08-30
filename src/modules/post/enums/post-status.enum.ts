export enum PostStatus {
  Pending = 'pending',
  // Any pipeline stage has started but the post is not yet published. Replaces
  // the former annotation-centric `annotating`/`annotated` pair — the pipeline
  // has more stages than annotation, and stage-level progress is tracked on
  // `post_pipeline_runs`, not here (PLAN.md §3.2, §5).
  Processing = 'processing',
  Published = 'published',
  Failed = 'failed',
}
