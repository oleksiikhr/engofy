import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import { InvalidAnnotationOffsetError } from '../errors/invalid-annotation-offset.error.js';
import { InvalidAnnotationShapeError } from '../errors/invalid-annotation-shape.error.js';
import { OverlappingAnnotationsError } from '../errors/overlapping-annotations.error.js';

export interface Annotation {
  start: number;
  end: number;
  form: string;
  kind: 'word' | 'phrase';
  lemma?: string;
  pos?: string;
  // Best-guess CEFR level, used only when this annotation causes a new
  // Word/WordDefinition or Phrase to be created — ignored when one already
  // exists. Required for word (WordDefinition.cefrLevel is NOT NULL),
  // optional for phrase (Phrase.cefrLevel is nullable).
  cefrLevel?: string;
  // Canonical whole-phrase text (e.g. "take off"), the same for every
  // fragment sharing one phraseGroupId — distinct from `form`, which is the
  // literal substring at this specific fragment's offset (e.g. "took").
  phraseText?: string;
  phraseType?: string;
  // Ties together the fragments of one phrase instance that isn't a single
  // contiguous span — e.g. "took it off" is two fragments ("took", "off")
  // sharing one phraseGroupId. Required for every phrase annotation, even a
  // contiguous one (a single-fragment "group").
  phraseGroupId?: string;
}

const PARTS_OF_SPEECH: readonly string[] = Object.values(PartOfSpeech);
const CEFR_LEVELS: readonly string[] = Object.values(CefrLevel);
const PHRASE_TYPES: readonly string[] = Object.values(PhraseType);

function validateOffsets(text: string, annotation: Annotation): void {
  const { start, end, form } = annotation;

  if (!(start >= 0 && start < end && end <= text.length)) {
    throw new InvalidAnnotationOffsetError(
      `[${start}, ${end}) out of bounds for text of length ${text.length}`,
    );
  }

  if (text.slice(start, end) !== form) {
    throw new InvalidAnnotationOffsetError(
      `text[${start}:${end}] does not match form "${form}"`,
    );
  }
}

function validateWordShape(annotation: Annotation): void {
  if (
    !annotation.lemma ||
    !annotation.pos ||
    !PARTS_OF_SPEECH.includes(annotation.pos)
  ) {
    throw new InvalidAnnotationShapeError(
      'word annotation requires a non-empty lemma and a valid pos',
    );
  }

  if (!annotation.cefrLevel || !CEFR_LEVELS.includes(annotation.cefrLevel)) {
    throw new InvalidAnnotationShapeError(
      'word annotation requires a valid cefrLevel',
    );
  }
}

function validatePhraseShape(annotation: Annotation): void {
  if (!annotation.phraseText) {
    throw new InvalidAnnotationShapeError(
      'phrase annotation requires a non-empty phraseText',
    );
  }

  if (!annotation.phraseGroupId) {
    throw new InvalidAnnotationShapeError(
      'phrase annotation requires a non-empty phraseGroupId',
    );
  }

  if (
    annotation.phraseType !== undefined &&
    !PHRASE_TYPES.includes(annotation.phraseType)
  ) {
    throw new InvalidAnnotationShapeError(
      'phrase annotation has an invalid phraseType',
    );
  }

  if (
    annotation.cefrLevel !== undefined &&
    !CEFR_LEVELS.includes(annotation.cefrLevel)
  ) {
    throw new InvalidAnnotationShapeError(
      'phrase annotation has an invalid cefrLevel',
    );
  }
}

function validateShape(annotation: Annotation): void {
  if (annotation.kind === 'word') {
    validateWordShape(annotation);
    return;
  }

  validatePhraseShape(annotation);
}

function checkNoOverlaps(annotations: Annotation[]): void {
  const sorted = [...annotations].sort((a, b) => a.start - b.start);

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];

    if (previous && current && current.start < previous.end) {
      throw new OverlappingAnnotationsError(current.start, current.end);
    }
  }
}

// All-or-nothing: throws on the first invalid annotation found, so callers must not
// write any of the batch's results unless this returns without throwing.
export function validateAnnotations(
  text: string,
  annotations: Annotation[],
): void {
  for (const annotation of annotations) {
    validateOffsets(text, annotation);
    validateShape(annotation);
  }

  checkNoOverlaps(annotations);
}
