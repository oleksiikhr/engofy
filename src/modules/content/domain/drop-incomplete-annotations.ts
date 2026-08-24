import { InvalidAnnotationShapeError } from '../errors/invalid-annotation-shape.error.js';
import type { Annotation } from './validate-annotations.js';
import { validateShape } from './validate-annotations.js';

// Anthropic's strict tool schema doesn't reliably enforce kind-conditional
// requiredness (allOf/if/then is accepted but silently unenforced; oneOf is
// outright rejected — "Schema type 'oneOf' is not supported"), so
// lemma/pos/cefrLevel/phraseText/phraseGroupId stay optional at the schema
// level and a model occasionally still omits one. Drop those annotations
// here — reusing validateShape's exact rules via try/catch, so this can't
// drift from what validateAnnotations actually requires — instead of
// letting one incomplete span crash and retry the whole block.
export function dropIncompleteAnnotations(
  annotations: Annotation[],
): Annotation[] {
  return annotations.filter((annotation) => {
    try {
      validateShape(annotation);
      return true;
    } catch (err) {
      if (err instanceof InvalidAnnotationShapeError) {
        return false;
      }
      throw err;
    }
  });
}
