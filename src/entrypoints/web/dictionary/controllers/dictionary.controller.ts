import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import { DictionaryResponseDto } from '../dto/dictionary-response.dto.js';

// The learner's personal dictionary (PLAN.md §4 `/dictionary`): every word /
// phrase SRS card with its status and the posts it appears in. Behind the
// global SessionAuthGuard.
@ApiTags('dictionary')
@ApiCookieAuth()
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  dictionary(@CurrentUser() actor: UserActor): Promise<DictionaryResponseDto> {
    return this.learning.getDictionary(actor.id);
  }
}
