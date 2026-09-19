import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { LearningService } from '../../../../modules/learning/learning.service.js';
import type { PracticeQueueItem } from '../../../../modules/learning/queries/get-practice-queue/practice-queue-item.js';
import type { CardView } from '../../../../modules/learning/types/card-view.type.js';
import type { DispositionView } from '../../../../modules/learning/types/disposition-view.type.js';
import { AddCardDto } from '../dto/add-card.dto.js';
import { DispositionResponseDto } from '../dto/disposition-response.dto.js';
import { DueCardCountResponseDto } from '../dto/due-card-count-response.dto.js';
import { LearningCardResponseDto } from '../dto/learning-card-response.dto.js';
import { PracticeQueueQueryDto } from '../dto/practice-queue-query.dto.js';
import {
  PracticeQueueItemDto,
  PracticeQueueResponseDto,
} from '../dto/practice-queue-response.dto.js';
import { ReviewCardDto } from '../dto/review-card.dto.js';
import { SetDispositionDto } from '../dto/set-disposition.dto.js';
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
  constructor(private readonly learning: LearningService) {}

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
  // `?bypassNewLimit=true` (practice-redesign зріз 2).
  @Get('practice')
  async practiceQueue(
    @CurrentUser() actor: UserActor,
    @Query() query: PracticeQueueQueryDto,
  ): Promise<PracticeQueueResponseDto> {
    const result = await this.learning.getPracticeQueue(
      actor.id,
      query.limit,
      query.bypassNewLimit,
    );
    return {
      ...toOffsetPage(result.items.map(toQueueItemDto), null),
      heldBackNewCount: result.heldBackNewCount,
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

  // Daily review streak — for the header's day-streak display (PLAN.md
  // §16/§17 Track B), cheaper than the full `/profile` aggregate.
  @Get('streak')
  async streak(@CurrentUser() actor: UserActor): Promise<StreakResponseDto> {
    const streak = await this.learning.getStreak(actor.id);
    return { streak };
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
