export const NLP_CLIENT = Symbol('NLP_CLIENT');

// One spaCy token. Offsets are char offsets within the parent sentence's
// `text`; `head` is the sentence-local index of this token's syntactic head
// (equal to the token's own index when it is the sentence root).
export interface NlpToken {
  index: number;
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  morph: Record<string, string>;
  head: number;
  start: number;
  end: number;
}

// One spaCy sentence. Offsets are char offsets within the submitted text.
export interface NlpSentence {
  text: string;
  start: number;
  end: number;
  tokens: NlpToken[];
}

export interface NlpParseResult {
  sentences: NlpSentence[];
}

export interface NlpClient {
  // Segments and tokenises one plain-text unit (a flattened paragraph or a
  // single list item) via the nlp-service.
  parse(text: string): Promise<NlpParseResult>;
}
