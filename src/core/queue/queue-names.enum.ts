export enum QueueName {
  AuthChallengeEmail = 'auth-challenge-email',
  AuthAccountDeletionEmail = 'auth-account-deletion-email',
  PostAnnotation = 'post-annotation',
  PostSpacyParse = 'post-spacy-parse',
  PostAiComplexity = 'post-ai-complexity',
  PostAiGrammar = 'post-ai-grammar',
  PostAiEnrichment = 'post-ai-enrichment',
  PostAiGrammarEnrichment = 'post-ai-grammar-enrichment',
  PostAiExercises = 'post-ai-exercises',
  PostPublish = 'post-publish',
}

export const ALL_QUEUE_NAMES = Object.values(QueueName);
