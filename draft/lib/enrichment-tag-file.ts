import {
  buildEnrichmentUserText,
  ENRICHMENT_SYSTEM_PROMPT,
  enrichmentToolSchema,
  indexEnrichmentResult,
  type PendingPhrase,
  type PendingWord,
  type PhraseEnrichmentEntry,
  type WordEnrichmentEntry,
} from '../../src/modules/post/domain/enrichment-prompt.js';
import { callClaudeStructured } from './call-claude-structured.js';

interface CallOptions {
  model?: string;
  thinking?: boolean;
}

export interface EnrichmentTagTotals {
  wordCount: number;
  phraseCount: number;
  // Words missing a phonetic (the model may legitimately return null when
  // unsure — tracked as a quality signal, not a failure).
  wordsMissingPhonetic: number;
  cefrCounts: Record<string, number>;
}

export interface EnrichmentTagResult {
  words: WordEnrichmentEntry[];
  phrases: PhraseEnrichmentEntry[];
  totals: EnrichmentTagTotals;
  // False only if the model's response failed indexEnrichmentResult's
  // all-or-nothing coverage check (dropped/duplicated/invented an index) —
  // production has no retry here (unlike the inline-markup annotation/grammar
  // stages), a failure just fails the job for a pg-boss retry, so this
  // harness mirrors that: one call, pass or fail.
  isComplete: boolean;
  error?: string;
  truncated: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    elapsedMs: number;
  };
}

function tallyCefr(
  totals: Record<string, number>,
  entries: { cefrLevel: string }[],
): void {
  for (const entry of entries) {
    totals[entry.cefrLevel] = (totals[entry.cefrLevel] ?? 0) + 1;
  }
}

// Mirrors EnrichLexiconHandler.execute's AI call exactly: one
// completeStructured call against ENRICHMENT_SYSTEM_PROMPT +
// buildEnrichmentUserText, then the real indexEnrichmentResult
// all-or-nothing coverage check. Only the transport is swapped
// (callClaudeStructured direct call vs. AiClient.completeStructured over Nest
// DI) — everything else (prompt, schema, indexing) is the production code.
export async function enrichmentTagFile(
  words: PendingWord[],
  phrases: PendingPhrase[],
  options: CallOptions = {},
): Promise<EnrichmentTagResult> {
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0, elapsedMs: 0 };

  if (words.length === 0 && phrases.length === 0) {
    return {
      words: [],
      phrases: [],
      totals: {
        wordCount: 0,
        phraseCount: 0,
        wordsMissingPhonetic: 0,
        cefrCounts: {},
      },
      isComplete: true,
      truncated: false,
      usage,
    };
  }

  const call = await callClaudeStructured({
    system: ENRICHMENT_SYSTEM_PROMPT,
    userText: buildEnrichmentUserText(words, phrases),
    tool: {
      name: 'report_enrichment',
      description:
        'Report a learner-dictionary definition, example sentence, CEFR level (and phonetic for words) for every word and phrase listed.',
      schema: enrichmentToolSchema,
    },
    model: options.model,
    thinking: options.thinking,
  });

  usage.inputTokens = call.usage.inputTokens;
  usage.outputTokens = call.usage.outputTokens;
  usage.costUsd = call.usage.costUsd ?? 0;
  usage.elapsedMs = call.usage.elapsedMs;

  try {
    const indexed = indexEnrichmentResult(
      call.data,
      words.length,
      phrases.length,
    );

    const cefrCounts: Record<string, number> = {};
    tallyCefr(cefrCounts, indexed.words);
    tallyCefr(cefrCounts, indexed.phrases);

    return {
      words: indexed.words,
      phrases: indexed.phrases,
      totals: {
        wordCount: words.length,
        phraseCount: phrases.length,
        wordsMissingPhonetic: indexed.words.filter((w) => w.phonetic === null)
          .length,
        cefrCounts,
      },
      isComplete: true,
      truncated: call.truncated,
      usage,
    };
  } catch (err) {
    return {
      words: [],
      phrases: [],
      totals: {
        wordCount: words.length,
        phraseCount: phrases.length,
        wordsMissingPhonetic: 0,
        cefrCounts: {},
      },
      isComplete: false,
      error: err instanceof Error ? err.message : String(err),
      truncated: call.truncated,
      usage,
    };
  }
}
