import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { AuthService } from '../../../../modules/auth/auth.service.js';
import { SetCefrLevelDto } from '../../../../modules/auth/commands/set-cefr-level/set-cefr-level.dto.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import { CefrLevelResponseDto } from '../dto/cefr-level-response.dto.js';
import { ProfileHubResponseDto } from '../dto/profile-hub-response.dto.js';
import { ProfileProgressResponseDto } from '../dto/profile-progress-response.dto.js';

@ApiTags('profile')
@ApiCookieAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly learning: LearningService,
    private readonly auth: AuthService,
  ) {}

  // The light /profile hub: just the daily streak and the self-reported CEFR
  // level (hub owns display + editing of the level, slice 3). The heavy
  // skills tree + CEFR breakdown moved to `/profile/progress` unchanged
  // (profile-hub-redesign slice 1).
  @Get()
  async profile(
    @CurrentUser() actor: UserActor,
  ): Promise<ProfileHubResponseDto> {
    const [streak, user] = await Promise.all([
      this.learning.getStreak(actor.id),
      this.auth.getUser(actor.id),
    ]);
    return { streak, cefrLevel: user.cefrLevel };
  }

  // Grammar skills tree (19 → 90 constructions, locked/unlocked + mastery),
  // daily review streak, and CEFR card breakdown for the current user. Was
  // `GET /profile` before profile-hub-redesign slice 1 split it off.
  @Get('progress')
  async progress(
    @CurrentUser() actor: UserActor,
  ): Promise<ProfileProgressResponseDto> {
    const view = await this.learning.getProfile(actor.id);
    return {
      streak: view.streak,
      activityDays: view.activityDays,
      cefr: view.cefr,
      categories: view.categories,
    };
  }

  // Change the learner's self-reported CEFR level. The only `@Patch` route in
  // the repo — every other mutation uses `@Post` + `HttpCode(OK)` (house
  // style), kept here because the plan names this route explicitly.
  @Patch('cefr-level')
  @HttpCode(HttpStatus.OK)
  async setCefrLevel(
    @CurrentUser() actor: UserActor,
    @Body() dto: SetCefrLevelDto,
  ): Promise<CefrLevelResponseDto> {
    const cefrLevel = await this.auth.setCefrLevel(actor.id, dto.cefrLevel);
    return { cefrLevel };
  }
}
