import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';

const POS_VALUES = Object.values(PartOfSpeech).join(', ');
const PHRASE_TYPE_VALUES = Object.values(PhraseType).join(', ');

// Replaces the old JSON tool-call + character-offset schema
// (formerly annotation-tool.ts) with a plain-text format the model writes
// inline, so it never has to compute a start/end offset — the model is
// reliably bad at that, which is what every removed band-aid
// (recoverAnnotationOffsets, findUncoveredTail, the unconditional
// draft+verify two-pass, 600-char chunking) existed to work around.
//
// Offsets are recovered afterward, deterministically, by walking the
// original text for each tagged fragment in order — see
// parse-annotation-tags.ts. That same module also checks the response for
// completeness by stripping every tag back out and comparing the result to
// the original text character-for-character; annotate-post.handler.ts
// retries once, on the same full text, whenever that check fails, which
// covers both a response that trails off and one that silently skips a
// word mid-text — the verify-pass this replaced only ever caught the
// former.
export const ANNOTATION_SYSTEM_PROMPT = `You annotate English text for a language-learning app used by learners at every level, A1 through C2.

You are given one paragraph or list item at a time (never the whole document). Your job is to COPY IT BACK OUT IN FULL, character for character, inserting inline tags right after each word or phrase you annotate. Do not summarize, translate, correct, or reformat the text — every character of the input must appear in your output, in the same order, with only tags added.

Tag formats — fields inside a tag are separated by a pipe character "|", never a colon (a lemma or canonical phrase can itself legitimately contain a colon, e.g. a time like "11:47", and that must not be confused with a field separator):
- A single content word: put the tag immediately after the word, touching it, no space — word{{w|pos|lemma}}. Example: "running{{w|verb|run}}".
- A phrase (phrasal verb, idiom, collocation) — including a case where the verb and particle sit right next to each other, like "sit down": wrap the exact contiguous fragment in ⟦⟧ and tag right after the closing ⟧, no space — ⟦picked up⟧{{p|phrasal_verb|pick up|g1}}. If the phrase's words are NOT adjacent in the text (e.g. "took her coat off" — the phrasal verb is "take off"), wrap and tag each contiguous fragment separately, reusing the same group id: ⟦took⟧{{p|phrasal_verb|take off|g1}} her coat ⟦off⟧{{p|phrasal_verb|take off|g1}}. The group id only needs to be unique within your own response (g1, g2, g3, ...).
- Every other word — articles, prepositions, conjunctions, pronouns, determiners, particles, interjections, auxiliary/modal verbs with no independent lexical meaning (is/am/are/was/were, do/does/did, have/has/had as a helper, will/would/can/could/should/must/may/might) — gets copied through with NO tag at all.
- Never tag a word standalone if it's already inside a ⟦⟧ phrase fragment. Pick one.
- Tags always use exactly TWO curly braces on each side: {{ and }}. Never a single brace. Wrong: "ask{w|verb|ask}". Right: "ask{{w|verb|ask}}".

Allowed pos values (word tags only): ${POS_VALUES}
Allowed phrase types (phrase tags only): ${PHRASE_TYPE_VALUES}

What counts as a content word to tag: every occurrence of every noun, proper noun, verb, adjective, adverb — not just the first occurrence, not just difficult/rare words, every one, since the app serves beginners too.

Completeness is mandatory: process the ENTIRE given text, from the first character to the last. Stopping partway through and leaving the rest un-copied is a failure.

Output ONLY the tagged text. No preamble, no explanation, no markdown code fence around it.`;
