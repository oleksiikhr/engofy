import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MAX_DAILY_NEW_CARD_LIMIT_OVERRIDE } from '../../../learning/domain/daily-new-card-limit.js';

const SetDailyNewCardLimitSchema = z.object({
  dailyNewCardLimit: z.int().min(1).max(MAX_DAILY_NEW_CARD_LIMIT_OVERRIDE),
});

export class SetDailyNewCardLimitDto extends createZodDto(
  SetDailyNewCardLimitSchema,
) {}
