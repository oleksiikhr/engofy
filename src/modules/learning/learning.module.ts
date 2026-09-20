import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BillingModule } from '../billing/billing.module.js';
import { AddCardHandler } from './commands/add-card/add-card.handler.js';
import { RemoveCardHandler } from './commands/remove-card/remove-card.handler.js';
import { ReviewCardHandler } from './commands/review-card/review-card.handler.js';
import { SetDispositionHandler } from './commands/set-disposition/set-disposition.handler.js';
import { LearningService } from './learning.service.js';
import { GetCardUsageHandler } from './queries/get-card-usage/get-card-usage.handler.js';
import { GetDictionaryHandler } from './queries/get-dictionary/get-dictionary.handler.js';
import { GetDueCardCountHandler } from './queries/get-due-card-count/get-due-card-count.handler.js';
import { GetDuePostCardsHandler } from './queries/get-due-post-cards/get-due-post-cards.handler.js';
import { GetNewCardBudgetHandler } from './queries/get-new-card-budget/get-new-card-budget.handler.js';
import { GetPhraseDictionaryDetailHandler } from './queries/get-phrase-dictionary-detail/get-phrase-dictionary-detail.handler.js';
import { GetPracticeQueueHandler } from './queries/get-practice-queue/get-practice-queue.handler.js';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler.js';
import { GetReviewsTodayHandler } from './queries/get-reviews-today/get-reviews-today.handler.js';
import { GetStreakHandler } from './queries/get-streak/get-streak.handler.js';
import { GetWordDictionaryDetailHandler } from './queries/get-word-dictionary-detail/get-word-dictionary-detail.handler.js';
import { CardLimitService } from './services/card-limit.service.js';
import { FsrsService } from './services/fsrs.service.js';
import { NewCardBudgetService } from './services/new-card-budget.service.js';
import { SkillProgressService } from './services/skill-progress.service.js';

// SRS over words / phrases / grammar (PLAN.md §3.5). Wraps ts-fsrs and the
// free-tier card cap; skill aggregation (Slice 7) will live alongside.
@Module({
  imports: [CqrsModule, BillingModule],
  providers: [
    LearningService,
    FsrsService,
    CardLimitService,
    NewCardBudgetService,
    SkillProgressService,
    AddCardHandler,
    ReviewCardHandler,
    RemoveCardHandler,
    SetDispositionHandler,
    GetPracticeQueueHandler,
    GetProfileHandler,
    GetDictionaryHandler,
    GetCardUsageHandler,
    GetDueCardCountHandler,
    GetDuePostCardsHandler,
    GetReviewsTodayHandler,
    GetStreakHandler,
    GetNewCardBudgetHandler,
    GetWordDictionaryDetailHandler,
    GetPhraseDictionaryDetailHandler,
  ],
  exports: [LearningService],
})
export class LearningModule {}
