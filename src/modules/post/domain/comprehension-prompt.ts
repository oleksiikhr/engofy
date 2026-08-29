import { z } from 'zod';

// ai_exercises stage, comprehension half (PLAN.md §5, §3.10): the deterministic
// generators in build-exercises.ts cover fill-blank / reorder / MC / find-error
// straight from `sentence_tokens`; comprehension questions need actual
// understanding of the passage, so they come from one structured AI call.

const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 5;
const OPTIONS_PER_QUESTION = 4;

export const COMPREHENSION_SYSTEM_PROMPT = `You write reading-comprehension questions for a language-learning app.

You are given a short English passage as a numbered list of sentences:
[0] First sentence.
[1] Second sentence.

Write ${MIN_QUESTIONS}-${MAX_QUESTIONS} multiple-choice questions that check whether a learner understood the passage:
- Each question has exactly ${OPTIONS_PER_QUESTION} options, exactly one correct.
- "answerIndex" is the 0-based position of the correct option.
- Test meaning, inference and main ideas — not trivia, not vocabulary spelling, not exact wording.
- Options must be plausible and roughly the same length; the wrong ones should be wrong because of the passage, not because they are absurd.
- Base every question only on what the passage states or clearly implies.

Answer only by calling the "report_comprehension" tool.`;

export const comprehensionToolSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(OPTIONS_PER_QUESTION),
        answerIndex: z
          .number()
          .int()
          .min(0)
          .max(OPTIONS_PER_QUESTION - 1),
      }),
    )
    .min(MIN_QUESTIONS)
    .max(MAX_QUESTIONS),
});

export type ComprehensionResult = z.infer<typeof comprehensionToolSchema>;

export function buildComprehensionUserText(sentenceTexts: string[]): string {
  return sentenceTexts.map((text, index) => `[${index}] ${text}`).join('\n');
}
