import { z } from 'zod';
import { ExerciseType } from '../enums/exercise-type.enum.js';

// Seed format for the usage-point exercise bank (assets/grammar-usage-point-
// -exercises.json, see assets/README.md): egpIndex -> array of exercises.
// Content is written by another session (no AI call from this codebase) —
// this schema is the contract that session's output must satisfy.

export const FillBlankPayloadSchema = z.object({
  // Contains exactly one blank placeholder, e.g. "I ___ to work by bus.".
  prompt: z.string().min(1),
  answer: z.string().min(1),
  // Word bank shown to the learner (answer + distractors); omitted means
  // free typing is the only mode.
  options: z.array(z.string().min(1)).min(2).optional(),
});

export const MultipleChoicePayloadSchema = z
  .object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answerIndex: z.number().int().min(0),
  })
  .refine((v) => v.answerIndex < v.options.length, {
    message: 'answerIndex must be a valid index into options',
    path: ['answerIndex'],
  });

export const ReorderPayloadSchema = z
  .object({
    // Token surface forms in a scrambled order.
    scrambled: z.array(z.string().min(1)).min(2),
    // answer[slot] = the target position of scrambled[slot] in the correct
    // sentence.
    answer: z.array(z.number().int().min(0)),
  })
  .refine((v) => v.scrambled.length === v.answer.length, {
    message: 'answer must have the same length as scrambled',
    path: ['answer'],
  });

export const FindErrorPayloadSchema = z.object({
  // The sentence with one word replaced by an incorrect form.
  prompt: z.string().min(1),
  incorrectForm: z.string().min(1),
  correction: z.string().min(1),
});

export const UsagePointExerciseSeedSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(ExerciseType.FillBlank),
    payload: FillBlankPayloadSchema,
  }),
  z.object({
    type: z.literal(ExerciseType.MultipleChoice),
    payload: MultipleChoicePayloadSchema,
  }),
  z.object({
    type: z.literal(ExerciseType.Reorder),
    payload: ReorderPayloadSchema,
  }),
  z.object({
    type: z.literal(ExerciseType.FindError),
    payload: FindErrorPayloadSchema,
  }),
]);

export type UsagePointExerciseSeed = z.infer<
  typeof UsagePointExerciseSeedSchema
>;

// JSON object keys are always strings — the egpIndex key is validated as a
// positive integer literal, parsed to a number by the importer.
const EGP_INDEX_KEY = z
  .string()
  .regex(/^[1-9]\d*$/, 'must be a positive integer egpIndex');

export const UsagePointExerciseSeedFileSchema = z.record(
  EGP_INDEX_KEY,
  z.array(UsagePointExerciseSeedSchema).min(1),
);

export type UsagePointExerciseSeedFile = z.infer<
  typeof UsagePointExerciseSeedFileSchema
>;

export function parseUsagePointExerciseSeedFile(
  raw: unknown,
): UsagePointExerciseSeedFile {
  return UsagePointExerciseSeedFileSchema.parse(raw);
}
