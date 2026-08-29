import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { LearningService } from '../../../../modules/learning/learning.service.js';
import { ProfileResponseDto } from '../dto/profile-response.dto.js';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly learning: LearningService) {}

  // Grammar skills tree (19 → 90 constructions, locked/unlocked + mastery),
  // daily review streak, and CEFR card breakdown for the current user.
  @Get()
  async profile(@CurrentUser() actor: UserActor): Promise<ProfileResponseDto> {
    const view = await this.learning.getProfile(actor.id);
    return {
      streak: view.streak,
      cefr: view.cefr,
      categories: view.categories,
    };
  }
}
