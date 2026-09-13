import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { DateTime } from 'luxon';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { HomeService } from '../../../../modules/home/home.service.js';
import type { DailyPlanView } from '../../../../modules/home/queries/get-daily-plan/daily-plan-view.js';
import { DailyPlanResponseDto } from '../dto/daily-plan-response.dto.js';

function iso(value: DateTime): string {
  return value.toISO() ?? value.toString();
}

function toDailyPlanDto(view: DailyPlanView): DailyPlanResponseDto {
  return {
    postShortId: view.postShortId,
    postSlug: view.postSlug,
    postTitle: view.postTitle,
    postCefrLevel: view.postCefrLevel,
    grammarUsagePointId: view.grammarUsagePointId,
    grammarGuideword: view.grammarGuideword,
    grammarCanDoStatement: view.grammarCanDoStatement,
    completedAt: view.completedAt ? iso(view.completedAt) : null,
  };
}

@ApiTags('home')
@ApiCookieAuth()
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  // Today's "Daily session" plan — find-or-create, so the first call of the
  // day picks a post + grammar highlight and every later call that day
  // returns the same one.
  @Get('daily-plan')
  async dailyPlan(
    @CurrentUser() actor: UserActor,
  ): Promise<DailyPlanResponseDto> {
    const view = await this.home.getDailyPlan(actor.id);
    return toDailyPlanDto(view);
  }
}
