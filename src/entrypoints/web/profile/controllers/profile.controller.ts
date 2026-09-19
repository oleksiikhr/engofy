import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { Public } from '../../../../core/decorators/public.decorator.js';
import { AuthService } from '../../../../modules/auth/auth.service.js';
import { CancelAccountDeletionByTokenDto } from '../../../../modules/auth/commands/cancel-account-deletion-by-token/cancel-account-deletion-by-token.dto.js';
import { SetCefrLevelDto } from '../../../../modules/auth/commands/set-cefr-level/set-cefr-level.dto.js';
import type { AccountDeletionView } from '../../../../modules/auth/types/account-deletion-view.type.js';
import { BillingService } from '../../../../modules/billing/billing.service.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import { AccountDeletionResponseDto } from '../dto/account-deletion-response.dto.js';
import { CefrLevelResponseDto } from '../dto/cefr-level-response.dto.js';
import { ProfileHubResponseDto } from '../dto/profile-hub-response.dto.js';
import { ProfileProgressResponseDto } from '../dto/profile-progress-response.dto.js';

function toAccountDeletionDto(
  view: AccountDeletionView,
): AccountDeletionResponseDto {
  return {
    requestedAt: view.requestedAt.toUTC().toISO() ?? '',
    scheduledFor: view.scheduledFor.toUTC().toISO() ?? '',
  };
}

@ApiTags('profile')
@ApiCookieAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly learning: LearningService,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
  ) {}

  // The light /profile hub: just the daily streak and the self-reported CEFR
  // level (hub owns display + editing of the level, slice 3). The heavy
  // skills tree + CEFR breakdown moved to `/profile/progress` unchanged
  // (profile-hub-redesign slice 1).
  @Get()
  async profile(
    @CurrentUser() actor: UserActor,
  ): Promise<ProfileHubResponseDto> {
    const [streak, user, accountDeletion] = await Promise.all([
      this.learning.getStreak(actor.id),
      this.auth.getUser(actor.id),
      this.auth.getAccountDeletion(actor.id),
    ]);
    return {
      streak,
      cefrLevel: user.cefrLevel,
      accountDeletion: accountDeletion
        ? toAccountDeletionDto(accountDeletion)
        : null,
    };
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

  // Starts the deletion grace period: mails a cancel link, ends premium now.
  // Idempotent while a request is pending. Two facade calls (two flushes) —
  // both steps are safe to repeat if the second fails and the client retries.
  @Post('account-deletion')
  @HttpCode(HttpStatus.OK)
  async requestAccountDeletion(
    @CurrentUser() actor: UserActor,
  ): Promise<AccountDeletionResponseDto> {
    const view = await this.auth.requestAccountDeletion(actor.id);
    await this.billing.cancelSubscription(actor.id);
    return toAccountDeletionDto(view);
  }

  // Cancel from the hub banner (session-authenticated).
  @Post('account-deletion/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAccountDeletion(@CurrentUser() actor: UserActor): Promise<void> {
    await this.auth.cancelAccountDeletion(actor.id);
  }

  // Cancel from the e-mailed link; the token is the credential, so no session.
  @Public()
  @Post('account-deletion/cancel-by-token')
  @HttpCode(HttpStatus.OK)
  async cancelAccountDeletionByToken(
    @Body() dto: CancelAccountDeletionByTokenDto,
  ): Promise<void> {
    await this.auth.cancelAccountDeletionByToken(dto);
  }
}
