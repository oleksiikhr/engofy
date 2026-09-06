// The post processing pipeline (PLAN.md §5). Each value is an independent,
// idempotent pg-boss job with its own PostPipelineRun row.
//
// There is no `fetch` stage: ingest takes pasted text synchronously on the
// HTTP path (PLAN.md §5), so the pipeline starts at `spacy_parse`. A future
// link-fetch would be a new leading stage.
export enum PostPipelineStage {
  // spaCy: tokenise, POS/lemma/morph/dep → sentences + sentence_tokens.
  SpacyParse = 'spacy_parse',
  // Node-tree word/phrase annotation over post_parts (idioms/collocations via
  // AI, the rest carried from spaCy).
  Annotation = 'annotation',
  // CEFR level of the post and each sentence.
  AiComplexity = 'ai_complexity',
  // Grammar constructions per sentence → grammar_matches.
  AiGrammar = 'ai_grammar',
  // Exercises beyond what deterministic generation covers.
  AiExercises = 'ai_exercises',
  // Flip posts.status = published, enqueue post_publications.
  Publish = 'publish',
}
