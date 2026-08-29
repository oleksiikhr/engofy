import { dedupeAnnotations } from '../../src/modules/post/domain/dedupe-annotations.js';
import { dropIncompleteAnnotations } from '../../src/modules/post/domain/drop-incomplete-annotations.js';
import { dropSpansCrossingNodeBoundaries } from '../../src/modules/post/domain/drop-spans-crossing-node-boundaries.js';
import type { NodeOffset } from '../../src/modules/post/domain/flatten.js';
import { parseAnnotationTags } from '../../src/modules/post/domain/parse-annotation-tags.js';
import { resolveWordPhraseOverlaps } from '../../src/modules/post/domain/resolve-word-phrase-overlaps.js';
import type { Annotation } from '../../src/modules/post/domain/validate-annotations.js';
import { validateAnnotations } from '../../src/modules/post/domain/validate-annotations.js';
import { callClaude } from './call-claude.js';

export interface AnnotateUnitParams {
  system: string;
  text: string;
  nodeOffsets?: NodeOffset[];
  model?: string;
  thinking?: boolean;
}

export interface AnnotateUnitResult {
  annotations: Annotation[];
  rawModelOutput: string;
  retried: boolean;
  retryRawModelOutput?: string;
  isComplete: boolean;
  validationError?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    elapsedMs: number;
    callCount: number;
  };
}

function cleanupAnnotations(
  raw: Annotation[],
  nodeOffsets: NodeOffset[] | undefined,
): Annotation[] {
  let annotations = dropIncompleteAnnotations(
    resolveWordPhraseOverlaps(dedupeAnnotations(raw)),
  );
  if (nodeOffsets) {
    annotations = dropSpansCrossingNodeBoundaries(nodeOffsets, annotations);
  }
  return annotations;
}

// Mirrors the LLM sub-pass of AnnotatePostHandler.computeAnnotations — the
// only part still driven by the model now that spaCy owns every word
// (PLAN.md §6, §12): same parseAnnotationTags, same whole-block retry on
// isComplete: false, same dedupe/overlap/boundary/incomplete cleanup. The
// deterministic spaCy word/phrasal-verb layer and its
// resolvePhraseOverlaps merge are out of scope here (no nlp-service in this
// harness); the only thing swapped out is the transport (callClaude direct
// call vs. AiClient.complete over Nest DI).
export async function annotateUnit(
  params: AnnotateUnitParams,
): Promise<AnnotateUnitResult> {
  const { system, text, nodeOffsets, model, thinking } = params;

  const call = await callClaude({ system, userText: text, model, thinking });
  const usage = {
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
    costUsd: call.usage.costUsd ?? 0,
    elapsedMs: call.elapsedMs,
    callCount: 1,
  };

  const first = parseAnnotationTags(text, call.text);
  let merged = first.annotations;
  let isComplete = first.isComplete;
  let retryRawModelOutput: string | undefined;

  if (!isComplete) {
    const retryCall = await callClaude({
      system,
      userText: text,
      model,
      thinking,
    });
    retryRawModelOutput = retryCall.text;

    usage.inputTokens += retryCall.usage.inputTokens;
    usage.outputTokens += retryCall.usage.outputTokens;
    usage.costUsd += retryCall.usage.costUsd ?? 0;
    usage.elapsedMs += retryCall.elapsedMs;
    usage.callCount += 1;

    const retry = parseAnnotationTags(text, retryCall.text);
    merged = [...merged, ...retry.annotations];
    isComplete = retry.isComplete;
  }

  const annotations = cleanupAnnotations(merged, nodeOffsets);

  let validationError: string | undefined;
  try {
    validateAnnotations(text, annotations);
  } catch (err) {
    validationError = err instanceof Error ? err.message : String(err);
  }

  return {
    annotations,
    rawModelOutput: call.text,
    retried: retryRawModelOutput !== undefined,
    retryRawModelOutput,
    isComplete,
    validationError,
    usage,
  };
}
