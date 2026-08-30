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
import { ApiTags } from '@nestjs/swagger';
import type { DateTime } from 'luxon';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import type { PracticeQueueItem } from '../../../../modules/learning/queries/get-practice-queue/practice-queue-item.js';
import type { CardView } from '../../../../modules/learning/types/card-view.type.js';
import { AddCardDto } from '../dto/add-card.dto.js';
import { LearningCardResponseDto } from '../dto/learning-card-response.dto.js';
import { PracticeQueueQueryDto } from '../dto/practice-queue-query.dto.js';
import { PracticeQueueItemDto } from '../dto/practice-queue-response.dto.js';
import { ReviewCardDto } from '../dto/review-card.dto.js';

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
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  // Add a word / phrase / grammar point to the SRS queue.
  @Post('cards')
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

  // The due-card review queue, soonest first.
  @Get('practice')
  async practiceQueue(
    @CurrentUser() actor: UserActor,
    @Query() query: PracticeQueueQueryDto,
  ): Promise<PracticeQueueItemDto[]> {
    const items = await this.learning.getPracticeQueue(actor.id, query.limit);
    return items.map(toQueueItemDto);
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
