import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { toCursorPage } from '../../../../core/http/dto/cursor-page.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import type { DictionaryEntryView } from '../../../../modules/learning/queries/get-dictionary/dictionary-view.js';
import type { WordDictionaryDetailView } from '../../../../modules/learning/queries/get-word-dictionary-detail/word-dictionary-detail-view.js';
import { DictionaryQueryDto } from '../dto/dictionary-query.dto.js';
import {
  DictionaryEntryDto,
  DictionaryResponseDto,
} from '../dto/dictionary-response.dto.js';
import { WordDictionaryDetailResponseDto } from '../dto/word-dictionary-detail-response.dto.js';

// The learner's personal dictionary (dictionary-redesign §1): every saved
// word (grouped by lemma) and phrase, with its effective state and the
// posts it appears in. Behind the global SessionAuthGuard.
@ApiTags('dictionary')
@ApiCookieAuth()
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  async dictionary(
    @CurrentUser() actor: UserActor,
    @Query() query: DictionaryQueryDto,
  ): Promise<DictionaryResponseDto> {
    const view = await this.learning.getDictionary(actor.id, {
      state: query.state,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
    return toCursorPage(view.items.map(toDictionaryEntryDto), view.nextCursor);
  }

  // `/dictionary/words/:lemma` (dictionary-redesign §2): every sense of the
  // lemma, irregular-verb forms if any, and the posts it appears in.
  @Get('words/:lemma')
  async wordDetail(
    @CurrentUser() actor: UserActor,
    @Param('lemma') lemma: string,
  ): Promise<WordDictionaryDetailResponseDto> {
    const view = await this.learning.getWordDictionaryDetail(lemma, actor.id);
    if (!view) {
      throw new NotFoundException('Word not found');
    }
    return toWordDictionaryDetailDto(view);
  }
}

function toDictionaryEntryDto(entry: DictionaryEntryView): DictionaryEntryDto {
  return {
    type: entry.type,
    primary: entry.primary,
    state: entry.state,
    senseCount: entry.senseCount,
    secondary: entry.secondary,
    definition: entry.definition,
    example: entry.example,
    cefrLevel: entry.cefrLevel,
    posts: entry.posts.map((post) => ({
      shortId: post.shortId,
      slug: post.slug,
      title: post.title,
    })),
  };
}

function toWordDictionaryDetailDto(
  view: WordDictionaryDetailView,
): WordDictionaryDetailResponseDto {
  return {
    lemma: view.lemma,
    frequencyRank: view.frequencyRank,
    irregularVerb: view.irregularVerb,
    senses: view.senses,
    posts: view.posts,
  };
}
