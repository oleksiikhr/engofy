import { DomainError } from '../../../core/errors/domain.error.js';

// buildTokenAnnotations resolves each phrasal-verb fragment's canonical text
// from the Phrase rows spacy_parse created (keyed by phrasal_verb_group_id). A
// miss means a sentence_token points at a phrase group with no Phrase row — a
// spacy_parse/annotate data-integrity break. Fail here with the real cause,
// not downstream as an opaque empty-`phraseText` shape error.
export class MissingPhraseTextError extends DomainError {
  constructor(phraseGroupId: string) {
    super(
      `no Phrase row for phrasal-verb group ${phraseGroupId} — re-run spacy_parse for this post`,
    );
  }
}
