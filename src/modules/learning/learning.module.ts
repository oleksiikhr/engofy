import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BillingModule } from '../billing/billing.module.js';
import { AddCardHandler } from './commands/add-card/add-card.handler.js';
import { ReviewCardHandler } from './commands/review-card/review-card.handler.js';
import { LearningService } from './learning.service.js';
import { GetPracticeQueueHandler } from './queries/get-practice-queue/get-practice-queue.handler.js';
import { CardLimitService } from './services/card-limit.service.js';
import { FsrsService } from './services/fsrs.service.js';

// SRS over words / phrases / grammar (PLAN.md §3.5). Wraps ts-fsrs and the
// free-tier card cap; skill aggregation (Slice 7) will live alongside.
@Module({
  imports: [CqrsModule, BillingModule],
  providers: [
    LearningService,
    FsrsService,
    CardLimitService,
    AddCardHandler,
    ReviewCardHandler,
    GetPracticeQueueHandler,
  ],
  exports: [LearningService],
})
export class LearningModule {}
