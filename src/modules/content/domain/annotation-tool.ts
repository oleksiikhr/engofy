import type { AiToolDefinition } from '../../../core/ai/ai-client.port.js';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';

const PART_OF_SPEECH_VALUES = Object.values(PartOfSpeech);
const CEFR_LEVEL_VALUES = Object.values(CefrLevel);
const PHRASE_TYPE_VALUES = Object.values(PhraseType);

// Tool-use schema for the content_annotation pipeline stage. Shape matches
// domain/validate-annotations.ts's Annotation exactly — the handler feeds
// this tool's output straight into validateAnnotations, so the two must not
// drift apart.
export const ANNOTATION_TOOL: AiToolDefinition = {
  name: 'record_annotations',
  description:
    'Records every content-word and phrase annotation found in the given text.',
  // strict guarantees additionalProperties/enum/type constraints and the
  // flat `required` below (start/end/form/kind), which stops the stray
  // hallucinated fields (e.g. an extra "start2") and missing-array crashes
  // we hit in testing. It does NOT reliably enforce kind-conditional
  // requiredness — an allOf/if/then ("word kind requires lemma/pos/
  // cefrLevel") was silently unenforced under strict, and a oneOf
  // discriminated union is outright rejected ("Schema type 'oneOf' is not
  // supported"). So lemma/pos/cefrLevel/phraseText/phraseGroupId stay
  // optional at the schema level ("word kind only" / "phrase kind only" in
  // their descriptions) — domain/drop-incomplete-annotations.ts filters out
  // any annotation still missing them before validateAnnotations, instead
  // of the whole block's pipeline crashing on one bad span.
  strict: true,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      spans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: {
              type: 'integer',
              description:
                'Start offset into the given text, 0-indexed, inclusive.',
            },
            end: {
              type: 'integer',
              description: 'End offset into the given text, exclusive.',
            },
            form: {
              type: 'string',
              description:
                'Exact substring text[start:end] — must match character-for-character, including case.',
            },
            kind: { type: 'string', enum: ['word', 'phrase'] },
            lemma: {
              type: 'string',
              description:
                'Dictionary base form of the word (e.g. "run" for "running"). word kind only, always required for word kind.',
            },
            pos: {
              type: 'string',
              enum: PART_OF_SPEECH_VALUES,
              description:
                'Part of speech. word kind only, always required for word kind.',
            },
            cefrLevel: {
              type: 'string',
              enum: CEFR_LEVEL_VALUES,
              description:
                'Best-guess CEFR level (A1-C2) of this word or phrase. Always required for word kind.',
            },
            phraseText: {
              type: 'string',
              description:
                'Canonical whole-phrase text (e.g. "take off"), the dictionary/base form of the phrase — the SAME value on every fragment sharing one phraseGroupId, even though each fragment\'s own `form` differs. phrase kind only, always required for phrase kind.',
            },
            phraseType: {
              type: 'string',
              enum: PHRASE_TYPE_VALUES,
              description: 'phrase kind only.',
            },
            phraseGroupId: {
              type: 'string',
              description:
                'An id you choose, unique within this response, shared by every fragment of one phrase instance. A phrase whose words are not adjacent in the text (e.g. "took ... off" in "took her coat off") is recorded as one span per contiguous fragment ("took", "off"), all sharing this same phraseGroupId — never as one span covering the words in between. phrase kind only, always required for phrase kind (even a single-fragment phrase still gets a phraseGroupId).',
            },
          },
          required: ['start', 'end', 'form', 'kind'],
          additionalProperties: false,
        },
      },
    },
    required: ['spans'],
  },
};

export const ANNOTATION_SYSTEM_PROMPT = `You annotate English text for a language-learning app used by learners at every level, A1 through C2.

You are given one paragraph or list item at a time (never the whole document) — its exact text follows this prompt. Call the record_annotations tool once with every annotation for this text.

What to annotate:
- Every occurrence of every content word: noun, proper noun, verb, adjective, adverb. Not just the first occurrence, not just difficult/rare words — every one, since the app serves beginners too, for whom even common words need a definition.
- Every phrasal verb, idiom, and collocation, as a "phrase" annotation. When a phrase's words are not adjacent in the text (e.g. "took her coat off" — the phrasal verb is "take off"), record one span per contiguous fragment ("took", "off"), sharing one phraseGroupId — never a single span covering the words in between.

What to skip:
- Pure function words with no independent phrase role: articles, prepositions, conjunctions, auxiliaries, pronouns, determiners, particles, interjections.
- A word already covered by a phrase fragment — do not also tag it standalone as a word. Pick one.

Offsets must be exact: text[start:end] (0-indexed, end exclusive) must equal the "form" you give, character for character. Annotations must not overlap.`;
