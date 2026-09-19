import { z } from 'zod';

// ai_exercises stage, grammar half: one structured AI call per grammar usage
// point matched in the post (deterministic generators in build-exercises.ts
// cover the other exercise types). Each call explains why the construction
// used in a sentence fits and its same-category siblings do not, and asks a
// contrastive multiple-choice question about that sentence.

export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 4;
const MAX_SIBLING_GUIDEWORDS = 3;

export const GRAMMAR_CONTRASTIVE_SYSTEM_PROMPT = `You write contrastive grammar exercises for a language-learning app.

You are given one English sentence from a reading passage, with the grammar construction being taught marked as ⟦…⟧, the usage point it illustrates, and the competing constructions from the same grammar category.

Produce:
- "explanation": 1-3 plain sentences telling the learner why the marked construction is used here and why a competing construction would not fit or would change the meaning. Name the competing construction.
- "question": a multiple-choice question about this sentence that tests the contrast — e.g. the sentence with the marked part blanked out as "____", asking which form completes it.
- "options": ${MIN_OPTIONS}-${MAX_OPTIONS} short options. Exactly one is the form actually used in the sentence; the others are natural forms of the competing constructions that are wrong in this context.
- "answerIndex": the 0-based position of the correct option.
- "optionExplanations": one short sentence per option, in the same order as "options" — for the correct option why it fits, for each wrong option why it does not.

Keep everything in simple English suited to the learner. Base the exercise only on the given sentence.

Answer only by calling the "report_grammar_contrastive" tool.`;

// The model occasionally sends an array field as a JSON-encoded string
// (`"[\"has lived\", \"lived\"]"`); unwrap it before validation. Anything that
// does not decode to an array is passed through and fails the schema as before.
function parseJsonArrayString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export const grammarContrastiveToolSchema = z
  .object({
    explanation: z.string().min(1),
    question: z.string().min(1),
    options: z.preprocess(
      parseJsonArrayString,
      z.array(z.string().min(1)).min(MIN_OPTIONS).max(MAX_OPTIONS),
    ),
    answerIndex: z.number().int().min(0),
    optionExplanations: z.preprocess(
      parseJsonArrayString,
      z.array(z.string().min(1)),
    ),
  })
  .refine((value) => value.answerIndex < value.options.length, {
    message: 'answerIndex must point at one of the options',
    path: ['answerIndex'],
  })
  .refine((value) => value.optionExplanations.length === value.options.length, {
    message: 'optionExplanations must have one entry per option',
    path: ['optionExplanations'],
  });

export type GrammarContrastiveResult = z.infer<
  typeof grammarContrastiveToolSchema
>;

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
