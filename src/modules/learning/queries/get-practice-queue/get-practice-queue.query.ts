import { Query } from '@nestjs/cqrs';
import type { PracticeQueueResult } from './practice-queue-item.js';

export class GetPracticeQueueQuery extends Query<PracticeQueueResult> {
  constructor(
    readonly userId: string,
    readonly limit: number,
    // Skips the daily new-card cap for this call — the "Show N more new"
    // button's current-session-only bypass (practice-redesign зріз 2). Never
    // touches the free-tier 100-card cap, which lives only in
    // `CardLimitService`.
    readonly bypassNewLimit: boolean = false,
  ) {
    super();
  }
}
