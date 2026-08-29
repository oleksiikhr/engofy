import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';

export const COMPLEXITY_SYSTEM_PROMPT = `You assess the CEFR difficulty of short English passages for a reading app.

You are given the passage as a numbered list of sentences, one per line, in the form:
[0] First sentence.
[1] Second sentence.

Assess:
- "overall": the CEFR level (A1, A2, B1, B2, C1, C2) of the passage taken as a whole — the level a learner needs to comfortably read it.
- "sentences": the CEFR level of EACH sentence on its own. Every index in the input must appear exactly once.
- "newVocabRatio": your estimate, between 0 and 1, of the fraction of running words in the passage that a learner AT THE "overall" LEVEL would not already know.

Judge on vocabulary frequency, grammatical structures, sentence length and idiomatic density. Answer only by calling the "report_complexity" tool.`;

export const complexityToolSchema = z.object({
  overall: z.enum(CefrLevel),
  newVocabRatio: z.number().min(0).max(1),
  sentences: z.array(
    z.object({
      index: z.number().int().min(0),
      level: z.enum(CefrLevel),
    }),
  ),
});

export type ComplexityAssessment = z.infer<typeof complexityToolSchema>;

export function buildComplexityUserText(sentenceTexts: string[]): string {
  return sentenceTexts.map((text, index) => `[${index}] ${text}`).join('\n');
}

// Flattens the model's per-sentence assessment into a level array positional
// to the sentences that were sent, failing (PLAN.md §12 all-or-nothing) if
// the model dropped, duplicated, or invented an index.
export function indexComplexityLevels(
  assessment: ComplexityAssessment,
  sentenceCount: number,
): CefrLevel[] {
  const byIndex = new Map<number, CefrLevel>();

  for (const { index, level } of assessment.sentences) {
    if (index < 0 || index >= sentenceCount) {
      throw new Error(
        `ai_complexity returned sentence index ${index} out of range 0..${sentenceCount - 1}`,
      );
    }
    if (byIndex.has(index)) {
      throw new Error(`ai_complexity returned sentence index ${index} twice`);
    }
    byIndex.set(index, level);
  }

  if (byIndex.size !== sentenceCount) {
    throw new Error(
      `ai_complexity covered ${byIndex.size} of ${sentenceCount} sentences`,
    );
  }

  return Array.from({ length: sentenceCount }, (_, i) => {
    const level = byIndex.get(i);
    if (!level) {
      throw new Error(`ai_complexity missing sentence index ${i}`);
    }
    return level;
  });
}
