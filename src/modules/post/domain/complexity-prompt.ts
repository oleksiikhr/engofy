import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';

// `needsTitle`: the post had neither an explicit title nor a leading H1 at
// ingest (deriveTitleFromHeading), so this stage is also the one place a
// title gets generated — never left null, never a hardcoded placeholder.
export function buildComplexitySystemPrompt(needsTitle: boolean): string {
  const titleField = needsTitle
    ? `\n- "title": a short, specific, human-readable title for the passage (max ~80 characters). None was supplied — write one that summarizes what the passage is actually about, not a generic label.`
    : '';
  return `You assess the CEFR difficulty of short English passages for a reading app.

You are given the passage as a numbered list of sentences, one per line, in the form:
[0] First sentence.
[1] Second sentence.

Assess:
- "overall": the CEFR level (A1, A2, B1, B2, C1, C2) of the passage taken as a whole — the level a learner needs to comfortably read it.
- "sentences": the CEFR level of EACH sentence on its own. Every index in the input must appear exactly once.
- "newVocabRatio": your estimate, between 0 and 1, of the fraction of running words in the passage that a learner AT THE "overall" LEVEL would not already know.
- "metaDescription": a natural, human-readable summary of the passage in English, 120–155 characters, suitable as an HTML meta description / social-share preview. Describe what the passage says, don't just restate its title.${titleField}

Judge on vocabulary frequency, grammatical structures, sentence length and idiomatic density. Answer only by calling the "report_complexity" tool.`;
}

const complexityBaseFields = {
  overall: z.enum(CefrLevel),
  newVocabRatio: z.number().min(0).max(1),
  metaDescription: z.string().min(1),
  sentences: z.array(
    z.object({
      index: z.number().int().min(0),
      level: z.enum(CefrLevel),
    }),
  ),
};

// `title` stays optional on the base schema (rather than a separately-typed
// variant) so both branches of the ai_complexity call share one return type —
// a real union of "with title" / "without" would collapse back to the
// wider type anyway, since a subtype adds no information to a union with
// its own supertype.
export const complexityToolSchema = z.object({
  ...complexityBaseFields,
  title: z.string().min(1).optional(),
});
export const complexityToolSchemaWithTitle = z.object({
  ...complexityBaseFields,
  title: z.string().min(1),
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
