import { Query } from '@nestjs/cqrs';
import type { PracticeQueueItem } from './practice-queue-item.js';

export class GetPracticeQueueQuery extends Query<PracticeQueueItem[]> {
  constructor(
    readonly userId: string,
    readonly limit: number,
  ) {
    super();
  }
}
