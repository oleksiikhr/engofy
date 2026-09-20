import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MAX_DAILY_GOAL = 200;

const SetDailyGoalSchema = z.object({
  dailyGoal: z.int().min(1).max(MAX_DAILY_GOAL),
});

export class SetDailyGoalDto extends createZodDto(SetDailyGoalSchema) {}
