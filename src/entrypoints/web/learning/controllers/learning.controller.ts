import {
  Body,
  Controller,
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
import { AddCardDto } from '../dto/add-card.dto.js';
import { DueCardCountResponseDto } from '../dto/due-card-count-response.dto.js';
import { LearningCardResponseDto } from '../dto/learning-card-response.dto.js';
import { PracticeQueueQueryDto } from '../dto/practice-queue-query.dto.js';
import {
  PracticeQueueItemDto,
  PracticeQueueResponseDto,
} from '../dto/practice-queue-response.dto.js';
import { ReviewCardDto } from '../dto/review-card.dto.js';
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

function toQueueItemDto(item: PracticeQueueItem): PracticeQueueItemDto {
  return {
    cardId: item.cardId,
    state: item.state,
    due: iso(item.due),
    target: {
      type: item.target.type,
      id: item.target.id,
      primary: item.target.primary,
      secondary: item.target.secondary,
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
      wordId: dto.wordId ?? null,
      phraseId: dto.phraseId ?? null,
      grammarUsagePointId: dto.grammarUsagePointId ?? null,
    });
    return toCardDto(card);
  }

  // The due-card review queue, soonest first. Capped at `?limit=`; no offset
  // param, so the `{ items, nextOffset }` envelope always carries a null
  // `nextOffset` (shape parity with the other list endpoints, D14 #36).
  @Get('practice')
  async practiceQueue(
    @CurrentUser() actor: UserActor,
    @Query() query: PracticeQueueQueryDto,
  ): Promise<PracticeQueueResponseDto> {
    const items = await this.learning.getPracticeQueue(actor.id, query.limit);
    return toOffsetPage(items.map(toQueueItemDto), null);
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
}
