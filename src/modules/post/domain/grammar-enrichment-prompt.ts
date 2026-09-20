import { z } from 'zod';

// grammar_enrichment stage: one structured AI call per grammar usage point
// the post matched and that has no learner content yet. Replaces the raw EGP
// corpus snippet with a short explanation and clean example sentences.

const MAX_CHEAT_SHEET_CHARS = 1500;

export const GRAMMAR_ENRICHMENT_SYSTEM_PROMPT = `You write short grammar help for learners of English in a CEFR-graded reading app.

You are given one grammar usage point: the construction it belongs to, a can-do statement describing what a learner at that level can do with it, and (when available) the construction's form notes.

Produce:
- "explanation": 2-3 short sentences in plain English telling the learner why we use this construction for this purpose and how it is formed (the pattern, e.g. "have/has + past participle"). Write at the usage point's CEFR level or easier. No grammar jargon beyond the construction's own name.
- "explanationUk": the same explanation written in natural Ukrainian (a faithful translation, not a paraphrase). Keep the construction pattern itself (e.g. "have/has + past participle") in English.
- "example1", "example2" (and optionally "example3"): natural, complete example sentences that show exactly this use. Each is one sentence of at most 12 words, everyday vocabulary, no quotation marks, no corpus-style fragments. Leave "example3" out unless a third example adds something different.

Answer only by calling the "report_grammar_enrichment" tool.`;

// Flat scalar fields, not an array of examples (core/ai rule AI7).
const text = z.string().min(1);

export const grammarEnrichmentToolSchema = z.object({
  explanation: text.max(600),
  explanationUk: text.max(800),
  example1: text.max(200),
  example2: text.max(200),
  example3: text.max(200).optional(),
});

export type GrammarEnrichmentResult = z.infer<
  typeof grammarEnrichmentToolSchema
>;

export interface GrammarEnrichmentContent {
  explanation: string;
  explanationUk: string;
  examples: string[];
}

export function toGrammarEnrichmentContent(
  result: GrammarEnrichmentResult,
): GrammarEnrichmentContent {
  const examples = [result.example1, result.example2];
  if (result.example3 !== undefined) {
    examples.push(result.example3);
  }
  return {
    explanation: result.explanation.trim(),
    explanationUk: result.explanationUk.trim(),
    examples,
  };
}

export interface GrammarEnrichmentInput {
  constructionName: string;
  categoryName: string;
  cefrLevel: string;
  guideword: string;
  canDoStatement: string;
  cheatSheetContent: string | null;
}

export function buildGrammarEnrichmentUserText(
  input: GrammarEnrichmentInput,
): string {
  const lines = [
    `Construction: ${input.constructionName} (${input.categoryName})`,
    `Level: ${input.cefrLevel}`,
    `Usage point: ${input.guideword}`,
    `Can-do statement: ${input.canDoStatement}`,
  ];
  if (input.cheatSheetContent) {
    lines.push(
      `Form notes:\n${input.cheatSheetContent.slice(0, MAX_CHEAT_SHEET_CHARS)}`,
    );
  }
  return lines.join('\n');
}
