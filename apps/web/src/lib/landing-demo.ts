import type {
  GrammarLexiconEntry,
  LexiconData,
  PhraseLexiconEntry,
  WordLexiconEntry,
} from './reader-lexicon';

// The landing page's interactive reader fragment: a few sentences whose
// labels open the real reader popup. The entries are written here, so the
// fragment needs no API call.

export type DemoPart =
  | string
  | { kind: 'word' | 'phrase' | 'grammar'; id: string; text: string };

export const DEMO_TEXT: DemoPart[][] = [
  [
    'Maya ',
    { kind: 'word', id: 'demo-word-commute', text: 'commutes' },
    ' to work by train. ',
    {
      kind: 'grammar',
      id: 'demo-grammar-used-to',
      text: 'She used to drive',
    },
    ', but the trains are faster now.',
  ],
  [
    'On the way she likes to ',
    { kind: 'phrase', id: 'demo-phrase-catch-up', text: 'catch up on' },
    ' the news and read something short.',
  ],
];

const words: Record<string, WordLexiconEntry> = {
  'demo-word-commute': {
    kind: 'word',
    id: 'demo-word-commute',
    lemma: 'commute',
    pos: 'verb',
    phonetic: '/kəˈmjuːt/',
    frequencyRank: null,
    definition: 'to travel regularly between home and work.',
    example: 'I commute to the city by bus every day.',
    translations: { uk: { translation: 'їздити на роботу' } },
    cefrLevel: 'B1',
    state: 'new',
  },
};

const phrases: Record<string, PhraseLexiconEntry> = {
  'demo-phrase-catch-up': {
    kind: 'phrase',
    id: 'demo-phrase-catch-up',
    text: 'catch up on',
    type: 'phrasal verb',
    definition: 'to spend time learning about something you have missed.',
    example: 'I need to catch up on my emails.',
    translations: { uk: { translation: 'надолужити, наздогнати' } },
    cefrLevel: 'B1',
    state: 'new',
  },
};

const grammar: Record<string, GrammarLexiconEntry> = {
  'demo-grammar-used-to': {
    id: 'demo-grammar-used-to',
    construction: 'used to + infinitive',
    // No real construction backs this demo, so the "Practice" link (which
    // needs a real `/grammar/{slug}` page) stays hidden — null egpIndex does
    // that regardless of the placeholder slug.
    constructionSlug: 'used-to',
    egpIndex: null,
    cefrLevel: 'B1',
    guideword: 'past habits',
    canDoStatement:
      'Can use “used to” to talk about things that were true or regular in the past but are not now.',
    explanation:
      'Use “used to” plus the base verb for a habit or state in the past that has changed.',
    translations: {
      uk: {
        explanation:
          '«Used to» + інфінітив описує звичку чи стан у минулому, які вже змінилися.',
      },
    },
    examples: ['We used to live by the sea.'],
    contrast: null,
    state: 'new',
    siblings: [],
  },
};

export const DEMO_LEXICON: LexiconData = { words, phrases, grammar };

const ATTR = {
  word: 'data-word-definition-id',
  phrase: 'data-phrase-id',
  grammar: 'data-grammar-usage-point-id',
} as const;

// The attribute the reader popup looks for on a label span.
export function demoAttrs(part: Exclude<DemoPart, string>) {
  return { [ATTR[part.kind]]: part.id };
}
