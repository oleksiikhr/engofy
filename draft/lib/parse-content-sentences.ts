import { convertToDoc } from '../../src/modules/post/converters/to-doc.converter.js';
import type { BuiltToken } from '../../src/modules/post/domain/build-sentences.js';
import { buildSentences } from '../../src/modules/post/domain/build-sentences.js';
import { detectPostSourceFormat } from '../../src/modules/post/domain/detect-post-source-format.js';
import { flattenPostPartUnits } from '../../src/modules/post/domain/flatten.js';
import { splitDocIntoParts } from '../../src/modules/post/domain/post-parts.js';
import { callNlp } from './call-nlp.js';

// One sentence as the ai_grammar stage sees it: the exact `Sentence.rawText`
// and `SentenceToken` char offsets the spacy_parse stage would persist.
export interface HarnessSentence {
  // block index (PostPart) . unit index . sentence position — matches the
  // ordering TagGrammarHandler loads sentences in.
  label: string;
  // Global position across the whole file, in that same order.
  index: number;
  text: string;
  tokens: BuiltToken[];
}

// Faithful mirror of ingest + spacy_parse: detect format -> convertToDoc ->
// one PostPart per top-level block -> flattenPostPartUnits -> nlp-service
// /parse per unit -> buildSentences (the real domain function, offsets
// validated). Produces the ordered sentence list ai_grammar runs against,
// without touching the database.
export async function parseContentSentences(
  rawText: string,
): Promise<HarnessSentence[]> {
  const format = detectPostSourceFormat(rawText);
  const doc = convertToDoc(format, rawText);

  const sentences: HarnessSentence[] = [];
  let index = 0;

  for (const spec of splitDocIntoParts(doc)) {
    for (const unit of flattenPostPartUnits(spec.body)) {
      if (!unit.text.trim()) {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one nlp-service call at a time, and `index` must stay in document order.
      const result = await callNlp(unit.text);
      for (const built of buildSentences(unit.text, result)) {
        sentences.push({
          label: `block${spec.blockIndex}-unit${unit.unitIndex}-s${built.position}`,
          index,
          text: built.rawText,
          tokens: built.tokens,
        });
        index += 1;
      }
    }
  }

  return sentences;
}
