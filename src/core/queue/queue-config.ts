import type { Queue } from 'pg-boss';
import { QueueName } from './queue-names.enum.js';

// Dead-letter sink for the paid AI pipeline stages (D4). A job that fails every
// retry has its payload copied here instead of sitting in `failed` unbounded.
// No worker consumes it — inspect / redrive via the `engofy queue` CLI.
export const POST_DEAD_LETTER_QUEUE = 'post-dead-letter';

// Shared base for every post pipeline queue (D8): one in-flight job per postId
// (callers pass `singletonKey: postId`), and a stuck active job is failed after
// an hour so a crashed worker can't wedge the queue forever.
const PIPELINE_BASE = {
  policy: 'singleton',
  expireInSeconds: 3600,
} as const satisfies Omit<Queue, 'name'>;

// Explicit retry + exponential backoff for the paid AI stages, plus a
// dead-letter queue so a poison job is quarantined rather than retried forever
// and burning tokens (D4).
const AI_STAGE_RETRY = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  deadLetter: POST_DEAD_LETTER_QUEUE,
} as const satisfies Omit<Queue, 'name'>;

// Deterministic stages (spaCy call, publish, e-mail) are cheap to re-run, so
// they get more attempts and no dead-letter.
const DETERMINISTIC_RETRY = {
  retryLimit: 5,
  retryDelay: 10,
  retryBackoff: true,
} as const satisfies Omit<Queue, 'name'>;

// Single source of truth for every queue's `createQueue` options.
// `PostQueueBootstrapService` is the only place this is consumed (D8).
export const QUEUE_DEFINITIONS: Record<QueueName, Omit<Queue, 'name'>> = {
  [QueueName.AuthChallengeEmail]: { ...DETERMINISTIC_RETRY },
  [QueueName.PostSpacyParse]: { ...PIPELINE_BASE, ...DETERMINISTIC_RETRY },
  [QueueName.PostAnnotation]: { ...PIPELINE_BASE, ...AI_STAGE_RETRY },
  [QueueName.PostAiComplexity]: { ...PIPELINE_BASE, ...AI_STAGE_RETRY },
  [QueueName.PostAiGrammar]: { ...PIPELINE_BASE, ...AI_STAGE_RETRY },
  [QueueName.PostAiExercises]: { ...PIPELINE_BASE, ...AI_STAGE_RETRY },
  [QueueName.PostPublish]: { ...PIPELINE_BASE, ...DETERMINISTIC_RETRY },
};
