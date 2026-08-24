export enum PartOfSpeech {
  Noun = 'noun',
  ProperNoun = 'proper_noun',
  Verb = 'verb',
  Auxiliary = 'auxiliary',
  Adjective = 'adjective',
  Adverb = 'adverb',
  Pronoun = 'pronoun',
  Determiner = 'determiner',
  Preposition = 'preposition',
  Conjunction = 'conjunction',
  Interjection = 'interjection',
  Numeral = 'numeral',
  Particle = 'particle',
  // Catch-all for a word the LLM can't confidently place in any of the
  // above — an explicit escape hatch beats forcing a wrong specific tag.
  Other = 'other',
}
