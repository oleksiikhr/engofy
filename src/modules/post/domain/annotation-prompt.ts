import { PhraseType } from '../enums/phrase-type.enum.js';

// The annotation stage is a thin AI layer over spaCy (PLAN.md §5, §6, §12):
// spaCy (sentence_tokens) already gives POS / lemma / morphology for every
// word and groups phrasal verbs deterministically, so the LLM's only job
// here is the one thing spaCy can't see structurally — multi-word idioms and
// non-compositional collocations.
//
// The output format is unchanged from the old all-words prompt: the model
// echoes the unit text back verbatim and wraps only the fragments it tags,
// so it never computes an offset. parse-annotation-tags.ts recovers offsets
// by walking the original text, and flags the response incomplete (→ one
// retry in annotate-post.handler.ts) if stripping every tag doesn't
// reconstruct the input character-for-character.
const IDIOM_PHRASE_TYPES = [PhraseType.Idiom, PhraseType.Collocation].join(
  ', ',
);

export const IDIOM_SYSTEM_PROMPT = `You find multi-word idioms and fixed collocations in English text for a language-learning app.

You are given one paragraph or list item at a time (never the whole document). COPY IT BACK OUT IN FULL, character for character — do not summarize, translate, correct, or reformat — inserting an inline tag only around each idiom or collocation you find. Every character of the input must appear in your output, in the same order, with only tags added.

WHAT TO TAG — and nothing else:
- Multi-word IDIOMS: a group of 2+ words whose meaning is not the sum of its parts — "at loose ends", "beat around the bush", "once in a blue moon", "a piece of cake", "call it a day".
- Fixed COLLOCATIONS: a group of 2+ words that habitually go together and would sound wrong reworded — "heavy rain", "make a decision", "pay attention", "strong coffee", "take a risk".

DO NOT TAG:
- Single words. Never emit a one-word tag — spaCy already handles every individual word.
- Phrasal verbs ("pick up", "take off", "sit down", "turn the light off"). These are detected separately and deterministically. Leave them completely untagged.
- Ordinary literal word combinations whose meaning is obvious from the words ("red car", "walked slowly", "the big house").
- Proper names, dates, numbers.
If a paragraph contains no idiom or collocation, copy it back with no tags at all — that is a correct and expected answer.

TAG FORMAT — wrap the exact contiguous fragment in ⟦⟧ and put the tag right after the closing ⟧, no space:
⟦heavy rain⟧{{p|collocation|heavy rain|g1}}
Fields are separated by "|", never ":" (a canonical phrase can legitimately contain a colon). The four fields are: the literal "p", the phrase type, the canonical dictionary form, and a group id.
- Allowed phrase types: ${IDIOM_PHRASE_TYPES}
- If the idiom's words are NOT adjacent in the text, wrap and tag each contiguous fragment separately, reusing the same group id: ⟦keep⟧{{p|idiom|keep tabs on|g1}} a close ⟦tab on⟧{{p|idiom|keep tabs on|g1}} him. The group id only needs to be unique within your own response (g1, g2, g3, ...).
- Tags always use exactly TWO curly braces on each side: {{ and }}. Never a single brace.

Output ONLY the copied-through text with tags. No preamble, no explanation, no markdown code fence.`;
