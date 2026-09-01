import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { DateTime } from 'luxon';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import type { DictionaryEntryView } from '../../../../modules/learning/queries/get-dictionary/dictionary-view.js';
import {
  DictionaryEntryDto,
  DictionaryResponseDto,
} from '../dto/dictionary-response.dto.js';

// The learner's personal dictionary (PLAN.md §4 `/dictionary`): every word /
// phrase SRS card with its status and the posts it appears in. Behind the
// global SessionAuthGuard.
@ApiTags('dictionary')
@ApiCookieAuth()
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  async dictionary(
    @CurrentUser() actor: UserActor,
  ): Promise<DictionaryResponseDto> {
    const view = await this.learning.getDictionary(actor.id);
    return { items: view.items.map(toDictionaryEntryDto) };
  }
}

// DateTime -> ISO-8601 at the HTTP edge, mirroring `learning` / `billing`
// (query results carry Luxon `DateTime`; the controller serialises it).
function iso(value: DateTime): string {
  return value.toISO() ?? value.toString();
}

function toDictionaryEntryDto(entry: DictionaryEntryView): DictionaryEntryDto {
  return {
    cardId: entry.cardId,
    type: entry.type,
    targetId: entry.targetId,
    state: entry.state,
    due: iso(entry.due),
    primary: entry.primary,
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
