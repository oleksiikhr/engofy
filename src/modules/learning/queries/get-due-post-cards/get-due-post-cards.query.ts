import { Query } from '@nestjs/cqrs';
import type { PracticeQueueItem } from '../get-practice-queue/practice-queue-item.js';

// Entry-point-agnostic: consumed by `daily-session-home` (Крок 2, via
// `HomeService`) and the reader's final screen (via `GET
// /learning/posts/:slugId/due-cards`).
export class GetDuePostCardsQuery extends Query<PracticeQueueItem[]> {
  constructor(
    readonly postId: string,
    readonly userId: string,
  ) {
    super();
  }
}
