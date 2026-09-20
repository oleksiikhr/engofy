import { z } from 'zod';

// ai_exercises stage, grammar half: one structured AI call per grammar usage
// point matched in the post (deterministic generators in build-exercises.ts
// cover the other exercise types). Each call explains why the construction
// used in a sentence fits and its same-category siblings do not, and asks a
// contrastive multiple-choice question about that sentence.

const MAX_SIBLING_GUIDEWORDS = 3;

export const GRAMMAR_CONTRASTIVE_SYSTEM_PROMPT = `You write contrastive grammar exercises for a language-learning app.

You are given one English sentence from a reading passage, with the grammar construction being taught marked as ⟦…⟧, the usage point it illustrates, and the competing constructions from the same grammar category.

Produce:
- "explanation": 1-3 plain sentences telling the learner why the marked construction is used here and why a competing construction would not fit or would change the meaning. Name the competing construction.
- "question": a multiple-choice question about this sentence that tests the contrast — e.g. the sentence with the marked part blanked out as "____", asking which form completes it.
- "correctOption": a short option — the form actually used in the sentence — and "correctExplanation": one short sentence on why it fits.
- "wrongOption1" and "wrongOption2" (and optionally "wrongOption3"): short options that are natural forms of the competing constructions but are wrong in this context, each with "wrongExplanation1", "wrongExplanation2" (and "wrongExplanation3"): one short sentence on why it does not fit. Leave "wrongOption3" and "wrongExplanation3" out unless a third wrong form is clearly useful.

Keep everything in simple English suited to the learner. Base the exercise only on the given sentence.

Answer only by calling the "report_grammar_contrastive" tool.`;

// The options are flat scalar fields, not an array: when asked for an array of
// options (strings or objects) the model intermittently breaks out of JSON and
// sends the field as a mangled string, failing ~10% of attempts (~50% with
// object items).
const text = z.string().min(1);

export const grammarContrastiveToolSchema = z
  .object({
    explanation: text,
    question: text,
    correctOption: text,
    correctExplanation: text,
    wrongOption1: text,
    wrongExplanation1: text,
    wrongOption2: text,
    wrongExplanation2: text,
    wrongOption3: text.optional(),
    wrongExplanation3: text.optional(),
  })
  .refine(
    (value) =>
      (value.wrongOption3 === undefined) ===
      (value.wrongExplanation3 === undefined),
    {
      message: 'wrongOption3 and wrongExplanation3 must be given together',
      path: ['wrongOption3'],
    },
  );

export type GrammarContrastiveResult = z.infer<
  typeof grammarContrastiveToolSchema
>;

// The shape stored in `exercises.payload` (read by apps/web): parallel
// `options` / `optionExplanations` arrays plus the correct option's index.
export interface GrammarContrastivePayload {
  explanation: string;
  question: string;
  options: string[];
  answerIndex: number;
  optionExplanations: string[];
}

// Stable per-question hash so the correct option is not always first, and a
// stage re-run rebuilds the same order.
function answerPosition(question: string, optionCount: number): number {
  let hash = 0;
  for (const char of question) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % optionCount;
}

export function toGrammarContrastivePayload(
  result: GrammarContrastiveResult,
): GrammarContrastivePayload {
  const wrong = [
    { text: result.wrongOption1, explanation: result.wrongExplanation1 },
    { text: result.wrongOption2, explanation: result.wrongExplanation2 },
  ];
  if (
    result.wrongOption3 !== undefined &&
    result.wrongExplanation3 !== undefined
  ) {
    wrong.push({
      text: result.wrongOption3,
      explanation: result.wrongExplanation3,
    });
  }
  const answerIndex = answerPosition(result.question, wrong.length + 1);
  const ordered = [...wrong];
  ordered.splice(answerIndex, 0, {
    text: result.correctOption,
    explanation: result.correctExplanation,
  });
  return {
    explanation: result.explanation,
    question: result.question,
    options: ordered.map((option) => option.text),
    answerIndex,
    optionExplanations: ordered.map((option) => option.explanation),
  };
}

export interface GrammarContrastiveSibling {
  name: string;
  guidewords: string[];
}

export interface GrammarContrastiveInput {
  // The full sentence with the matched token range wrapped in ⟦…⟧.
  markedSentence: string;
  constructionName: string;
  guideword: string;
  canDoStatement: string;
  siblings: GrammarContrastiveSibling[];
}

// Wraps the character range [charStart, charEnd) of `sentence` in ⟦…⟧.
export function markSentenceSpan(
  sentence: string,
  charStart: number,
  charEnd: number,
): string {
  return `${sentence.slice(0, charStart)}⟦${sentence.slice(charStart, charEnd)}⟧${sentence.slice(charEnd)}`;
}

export function buildGrammarContrastiveUserText(
  input: GrammarContrastiveInput,
): string {
  const siblings = input.siblings
    .map((sibling) => {
      const guidewords = sibling.guidewords
        .slice(0, MAX_SIBLING_GUIDEWORDS)
        .join('; ');
      return guidewords
        ? `- ${sibling.name} (${guidewords})`
        : `- ${sibling.name}`;
    })
    .join('\n');
  return [
    `Sentence: ${input.markedSentence}`,
    `Construction: ${input.constructionName}`,
    `Usage point: ${input.guideword} — ${input.canDoStatement}`,
    `Competing constructions:\n${siblings}`,
  ].join('\n');
}
