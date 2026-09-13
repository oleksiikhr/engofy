import { Query } from '@nestjs/cqrs';
import type { DailySessionSummaryView } from './daily-session-summary-view.js';

export class GetDailySessionSummaryQuery extends Query<DailySessionSummaryView> {
  constructor(readonly userId: string) {
    super();
  }
}
