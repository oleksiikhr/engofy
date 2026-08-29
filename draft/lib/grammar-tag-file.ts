import {
  buildGrammarUserText,
  parseGrammarResponse,
} from '../../src/modules/post/domain/grammar-prompt.js';
import { spanToTokenRange } from '../../src/modules/post/domain/grammar-span-tokens.js';
import { callClaude } from './call-claude.js';
import type { GrammarCatalog } from './grammar-catalog.js';
import type { HarnessSentence } from './parse-content-sentences.js';

// Same max_tokens as AnthropicClientService.complete — a whole article's
// sentences copied back with tags can be long.
const MAX_TOKENS = 16_000;

export type SpanDisposition =
  | 'persisted'
  | 'unknown-slug'
  | 'bad-egp-index'
  | 'no-token';

export interface TaggedSpan {
  form: string;
  slug: string;
  egpIndex: number | null;
  disposition: SpanDisposition;
  // Present only when disposition === 'persisted'.
  tokenStart?: number;
  tokenEnd?: number;
}

export interface TaggedSentence {
  label: string;
  index: number;
  text: string;
  spans: TaggedSpan[];
}

export interface GrammarTagTotals {
  sentenceCount: number;
  spanCount: number;
  persistedCount: number;
  droppedUnknownSlug: number;
  droppedBadEgpIndex: number;
  droppedNoToken: number;
  // Distinct construction slugs among the persisted spans — a coverage
  // signal (does the prompt still recognise a spread of constructions, or
  // has it collapsed onto one or two).
  distinctConstructions: number;
}

export interface GrammarTagResult {
  sentences: TaggedSentence[];
  totals: GrammarTagTotals;
  // Whole-response completeness from parseGrammarResponse (every input line
  // came back and reconstructed its sentence). Mirrors the annotation
  // harness's isComplete; the caller retried once if the first call was
  // false.
  isComplete: boolean;
  retried: boolean;
  // A call stopped on max_tokens — the response is truncated, which also
  // forces isComplete false.
  truncated: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    elapsedMs: number;
    callCount: number;
  };
}

interface CallOptions {
  model?: string;
  thinking?: boolean;
}

// Mirrors TagGrammarHandler.callModel exactly: one AI call, one retry on an
// incomplete parse, the later attempt used regardless (same contract as the
// annotation stage). The only swap is transport — callClaude instead of
// AiClient.complete over Nest DI.
export async function grammarTagFile(
  catalog: GrammarCatalog,
  sentences: HarnessSentence[],
  options: CallOptions = {},
): Promise<GrammarTagResult> {
  const sentenceTexts = sentences.map((s) => s.text);
  const userText = buildGrammarUserText(sentenceTexts);

  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    elapsedMs: 0,
    callCount: 0,
  };
  let truncated = false;

  const call = async (): Promise<string> => {
    const result = await callClaude({
      system: catalog.systemPrompt,
      userText,
      model: options.model,
      thinking: options.thinking,
      maxTokens: MAX_TOKENS,
    });
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    usage.costUsd += result.usage.costUsd ?? 0;
    usage.elapsedMs += result.elapsedMs;
    usage.callCount += 1;
    if (result.stopReason === 'max_tokens') {
      truncated = true;
    }
    return result.text;
  };

  let parsed = parseGrammarResponse(sentenceTexts, await call());
  let retried = false;
  if (!parsed.isComplete) {
    retried = true;
    parsed = parseGrammarResponse(sentenceTexts, await call());
  }

  const tagged: TaggedSentence[] = [];
  const totals: GrammarTagTotals = {
    sentenceCount: sentences.length,
    spanCount: 0,
    persistedCount: 0,
    droppedUnknownSlug: 0,
    droppedBadEgpIndex: 0,
    droppedNoToken: 0,
    distinctConstructions: 0,
  };
  const persistedSlugs = new Set<string>();

  for (const line of parsed.lines) {
    const sentence = sentences[line.index];
    const spans: TaggedSpan[] = [];

    for (const span of line.spans) {
      totals.spanCount += 1;
      const disposition = classifySpan(span, sentence, catalog);
      const entry: TaggedSpan = {
        form: span.form,
        slug: span.slug,
        egpIndex: span.egpIndex,
        disposition,
      };

      if (disposition === 'persisted') {
        // classifySpan already proved the range resolves.
        const range = spanToTokenRange(span, sentence.tokens);
        if (range) {
          entry.tokenStart = range.tokenStart;
          entry.tokenEnd = range.tokenEnd;
        }
        totals.persistedCount += 1;
        persistedSlugs.add(span.slug);
      } else if (disposition === 'unknown-slug') {
        totals.droppedUnknownSlug += 1;
      } else if (disposition === 'bad-egp-index') {
        totals.droppedBadEgpIndex += 1;
      } else {
        totals.droppedNoToken += 1;
      }

      spans.push(entry);
    }

    tagged.push({
      label: sentence.label,
      index: sentence.index,
      text: sentence.text,
      spans,
    });
  }

  totals.distinctConstructions = persistedSlugs.size;

  return {
    sentences: tagged,
    totals,
    isComplete: parsed.isComplete,
    retried,
    truncated,
    usage,
  };
}

// Same drop ladder as TagGrammarHandler.persistMatch: unknown slug ->
// missing/out-of-construction egpIndex -> span covers no token -> persisted.
function classifySpan(
  span: { slug: string; egpIndex: number | null; charStart: number; charEnd: number },
  sentence: HarnessSentence,
  catalog: GrammarCatalog,
): SpanDisposition {
  const validEgpIndexes = catalog.egpIndexesBySlug.get(span.slug);
  if (!validEgpIndexes) {
    return 'unknown-slug';
  }
  if (span.egpIndex === null || !validEgpIndexes.has(span.egpIndex)) {
    return 'bad-egp-index';
  }
  if (!spanToTokenRange(span, sentence.tokens)) {
    return 'no-token';
  }
  return 'persisted';
}
