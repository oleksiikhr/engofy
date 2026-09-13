import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CompleteDailyPlanHandler } from './commands/complete-daily-plan/complete-daily-plan.handler.js';
import { CreateDailyPlanHandler } from './commands/create-daily-plan/create-daily-plan.handler.js';
import { HomeService } from './home.service.js';
import { GetDailyPlanHandler } from './queries/get-daily-plan/get-daily-plan.handler.js';
import { GetDailySessionSummaryHandler } from './queries/get-daily-session-summary/get-daily-session-summary.handler.js';
import { SelectDailyPlanCandidateHandler } from './queries/select-daily-plan-candidate/select-daily-plan-candidate.handler.js';

const commandHandlers = [CompleteDailyPlanHandler, CreateDailyPlanHandler];

const queryHandlers = [
  GetDailyPlanHandler,
  GetDailySessionSummaryHandler,
  SelectDailyPlanCandidateHandler,
];

@Module({
  imports: [CqrsModule],
  providers: [HomeService, ...commandHandlers, ...queryHandlers],
  exports: [HomeService],
})
export class HomeModule {}
