import { Query } from '@nestjs/cqrs';
import type { PracticeQueueItem } from '../get-practice-queue/practice-queue-item.js';

// Entry-point-agnostic: consumed by `daily-session-home` (Крок 2) and, once
// built, `post-detail-redesign`'s reader final screen (PLAN see
// `.claude/plans/post-detail-redesign.md` зріз 5) — whichever lands first
// defines it, the other only calls it.
export class GetDuePostCardsQuery extends Query<PracticeQueueItem[]> {
  constructor(
    readonly postId: string,
    readonly userId: string,
  ) {
    super();
  }
}
