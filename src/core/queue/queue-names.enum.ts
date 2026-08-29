export enum QueueName {
  AuthChallengeEmail = 'auth-challenge-email',
  PostAnnotation = 'post-annotation',
  PostSpacyParse = 'post-spacy-parse',
  PostAiComplexity = 'post-ai-complexity',
  PostAiGrammar = 'post-ai-grammar',
  PostAiExercises = 'post-ai-exercises',
  PostPublish = 'post-publish',
}

export const ALL_QUEUE_NAMES = Object.values(QueueName);
