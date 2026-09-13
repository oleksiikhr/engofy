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
import { ProfileResponseDto } from '../dto/profile-response.dto.js';

@ApiTags('profile')
@ApiCookieAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly learning: LearningService,
    private readonly auth: AuthService,
  ) {}

  // Grammar skills tree (19 → 90 constructions, locked/unlocked + mastery),
  // daily review streak, CEFR card breakdown, and self-reported CEFR level
  // for the current user.
  @Get()
  async profile(@CurrentUser() actor: UserActor): Promise<ProfileResponseDto> {
    const [view, user] = await Promise.all([
      this.learning.getProfile(actor.id),
      this.auth.getUser(actor.id),
    ]);
    return {
      streak: view.streak,
      cefr: view.cefr,
      cefrLevel: user.cefrLevel,
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
