import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { DateTime } from 'luxon';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { toOffsetPage } from '../../../../core/http/dto/offset-page.js';
import { AuthService } from '../../../../modules/auth/auth.service.js';
import { BillingService } from '../../../../modules/billing/billing.service.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import type { PracticeQueueItem } from '../../../../modules/learning/queries/get-practice-queue/practice-queue-item.js';
import type { CardView } from '../../../../modules/learning/types/card-view.type.js';
import type { DispositionView } from '../../../../modules/learning/types/disposition-view.type.js';
import { parseSlugId } from '../../../../modules/post/queries/parse-slug-id.js';
import { AddCardDto } from '../dto/add-card.dto.js';
import { DispositionResponseDto } from '../dto/disposition-response.dto.js';
import { DueCardCountResponseDto } from '../dto/due-card-count-response.dto.js';
import { LearningCardResponseDto } from '../dto/learning-card-response.dto.js';
import { NewCardBudgetResponseDto } from '../dto/new-card-budget-response.dto.js';
import { PracticeQueueQueryDto } from '../dto/practice-queue-query.dto.js';
import {
  PracticeQueueItemDto,
  PracticeQueueResponseDto,
} from '../dto/practice-queue-response.dto.js';
import { ReviewCardDto } from '../dto/review-card.dto.js';
import { SetDispositionDto } from '../dto/set-disposition.dto.js';
import { StreakFreezeResponseDto } from '../dto/streak-freeze-response.dto.js';
import { StreakFreezeStatusResponseDto } from '../dto/streak-freeze-status-response.dto.js';
import { StreakResponseDto } from '../dto/streak-response.dto.js';

function iso(value: DateTime): string {
  return value.toISO() ?? value.toString();
}

function toCardDto(card: CardView): LearningCardResponseDto {
  return {
    id: card.id,
    state: card.state,
    due: iso(card.due),
    reps: card.reps,
    lapses: card.lapses,
    stability: card.stability,
    difficulty: card.difficulty,
  };
}

function toDispositionDto(view: DispositionView): DispositionResponseDto {
  return {
    id: view.id,
    disposition: view.disposition,
  };
}

// Exported for reuse by `HomeController`'s daily-session due-cards endpoint
// (daily-session-home plan, зріз 4) — same `PracticeQueueItem` shape.
export function toQueueItemDto(item: PracticeQueueItem): PracticeQueueItemDto {
  return {
    cardId: item.cardId,
    state: item.state,
    due: iso(item.due),
    target: {
      type: item.target.type,
      id: item.target.id,
      primary: item.target.primary,
      secondary: item.target.secondary,
      phonetic: item.target.phonetic,
      contextSentence: item.target.contextSentence,
      kicker: item.target.kicker,
      exampleText: item.target.exampleText,
      detailSlug: item.target.detailSlug,
    },
  };
}

@ApiTags('learning')
@ApiCookieAuth()
@Controller('learning')
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
  ) {}

  // Add a word / phrase / grammar point to the SRS queue. Idempotent — a
  // re-add returns the existing card, so this is `200`, not `201`.
  @Post('cards')
  @HttpCode(HttpStatus.OK)
  async addCard(
    @CurrentUser() actor: UserActor,
    @Body() dto: AddCardDto,
  ): Promise<LearningCardResponseDto> {
    const card = await this.learning.addCard(actor.id, {
      wordDefinitionId: dto.wordDefinitionId ?? null,
      phraseId: dto.phraseId ?? null,
      grammarUsagePointId: dto.grammarUsagePointId ?? null,
    });
    return toCardDto(card);
  }

  // The due-card review queue, soonest first. Capped at `?limit=`; no offset
  // param, so the `{ items, nextOffset }` envelope always carries a null
  // `nextOffset` (shape parity with the other list endpoints, D14 #36). New
  // cards are additionally throttled to the daily cap unless
  // `?bypassNewLimit=true` (practice-redesign зріз 2); `?types=word,grammar`
  // narrows it to those card types (зріз 4).
  @Get('practice')
  async practiceQueue(
    @CurrentUser() actor: UserActor,
    @Query() query: PracticeQueueQueryDto,
  ): Promise<PracticeQueueResponseDto> {
    const result = await this.learning.getPracticeQueue(
      actor.id,
      query.limit,
      query.bypassNewLimit,
      query.types,
    );
    return {
      ...toOffsetPage(result.items.map(toQueueItemDto), null),
      heldBackNewCount: result.heldBackNewCount,
      hasAnyCards: result.hasAnyCards,
    };
  }

  // Due cards whose target occurs in one post — backs the reader's final
  // screen. Same wire shape as `GET /learning/practice`; `slugId` is the
  // reader's `/posts/{slug}-{shortId}` key, parsed like the content routes.
  @Get('posts/:slugId/due-cards')
  async postDueCards(
    @Param('slugId') slugId: string,
    @CurrentUser() actor: UserActor,
  ): Promise<PracticeQueueResponseDto> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    const items = await this.learning.getDuePostCards(actor.id, shortId);
    return {
      ...toOffsetPage(items.map(toQueueItemDto), null),
      heldBackNewCount: 0,
      hasAnyCards: true,
    };
  }

  // How many of the user's cards are due right now — backs the feed's soft
  // "N due" badge (PLAN.md §16/§17 Track B), not the queue itself.
  @Get('due-count')
  async dueCount(
    @CurrentUser() actor: UserActor,
  ): Promise<DueCardCountResponseDto> {
    const dueCount = await this.learning.getDueCardCount(actor.id);
    return { dueCount };
  }

  // How many new cards the user may still add today — backs the reader's
  // study mode, which stops offering new words once it hits zero.
  @Get('new-card-budget')
  async newCardBudget(
    @CurrentUser() actor: UserActor,
  ): Promise<NewCardBudgetResponseDto> {
    const remaining = await this.learning.getNewCardBudget(actor.id);
    return { remaining };
  }

  // Daily review streak and daily-goal progress — for the header's day-streak
  // and goal ring (PLAN.md §16/§17 Track B), cheaper than the full `/profile`
  // aggregate.
  @Get('streak')
  async streak(@CurrentUser() actor: UserActor): Promise<StreakResponseDto> {
    const [streak, reviewedToday, user] = await Promise.all([
      this.learning.getStreak(actor.id),
      this.learning.getReviewsToday(actor.id),
      this.auth.getUser(actor.id),
    ]);
    return { streak, dailyGoal: user.dailyGoal, reviewedToday };
  }

  // This month's remaining streak-freeze balance and whether one can be
  // applied right now — backs `/profile`'s Premium-only streak-freeze card.
  // 0/false for Free/guest (`StreakFreezeService.status`), so no gate here.
  @Get('streak/freezes')
  async streakFreezeStatus(
    @CurrentUser() actor: UserActor,
  ): Promise<StreakFreezeStatusResponseDto> {
    const { balance, applicable } = await this.learning.getStreakFreezeStatus(
      actor.id,
    );
    return { balance, applicable };
  }

  // Spends one of the fixed monthly streak freezes to cover yesterday's gap.
  // Premium-only, same gate as `PATCH /profile/daily-new-card-limit`.
  @Post('streak/freeze')
  @HttpCode(HttpStatus.OK)
  async applyStreakFreeze(
    @CurrentUser() actor: UserActor,
  ): Promise<StreakFreezeResponseDto> {
    await this.billing.assertPremium(actor.id);
    const { streak, balance } = await this.learning.applyStreakFreeze(actor.id);
    return { streak, balance };
  }

  // Grade a card and reschedule it.
  @Post('cards/:cardId/review')
  @HttpCode(HttpStatus.OK)
  async reviewCard(
    @CurrentUser() actor: UserActor,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: ReviewCardDto,
  ): Promise<LearningCardResponseDto> {
    const card = await this.learning.reviewCard(actor.id, cardId, dto.rating);
    return toCardDto(card);
  }

  // Removes a card: an unreviewed card is deleted outright, a reviewed one is
  // archived (its progress and a Known disposition survive).
  @Delete('cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCard(
    @CurrentUser() actor: UserActor,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<void> {
    await this.learning.removeCard(actor.id, cardId);
  }

  // The "I already know this" / "skip this" control for a target with no
  // active card.
  @Post('dispositions')
  @HttpCode(HttpStatus.OK)
  async setDisposition(
    @CurrentUser() actor: UserActor,
    @Body() dto: SetDispositionDto,
  ): Promise<DispositionResponseDto> {
    const view = await this.learning.setDisposition(
      actor.id,
      {
        wordDefinitionId: dto.wordDefinitionId ?? null,
        phraseId: dto.phraseId ?? null,
        grammarUsagePointId: dto.grammarUsagePointId ?? null,
      },
      dto.disposition,
    );
    return toDispositionDto(view);
  }
}
