import type {
  NlpParseResult,
  NlpSentence,
  NlpToken,
} from '../../../core/nlp/nlp-client.port.js';
import { NlpOffsetMismatchError } from '../errors/nlp-offset-mismatch.error.js';
import {
  buildSentences,
  computePhrasalVerbKeys,
  detectGerund,
} from './build-sentences.js';

// Builds a token, deriving char offsets from a running cursor so fixtures
// stay readable. `gap` is whitespace before the token.
function tokens(
  specs: Array<
    Partial<NlpToken> & { text: string; head: number; gap?: number }
  >,
): { list: NlpToken[]; text: string } {
  let cursor = 0;
  let text = '';
  const list = specs.map((spec, index) => {
    cursor += spec.gap ?? (index === 0 ? 0 : 1);
    text = text.padEnd(cursor, ' ') + spec.text;
    const start = cursor;
    cursor += spec.text.length;
    return {
      index,
      text: spec.text,
      lemma: spec.lemma ?? spec.text.toLowerCase(),
      pos: spec.pos ?? 'X',
      tag: spec.tag ?? 'XX',
      dep: spec.dep ?? 'dep',
      morph: spec.morph ?? {},
      head: spec.head,
      start,
      end: cursor,
    } satisfies NlpToken;
  });
  return { list, text };
}

function sentence(
  specs: Parameters<typeof tokens>[0],
  offset = 0,
): NlpSentence {
  const { list, text } = tokens(specs);
  return { text, start: offset, end: offset + text.length, tokens: list };
}

describe('buildSentences', () => {
  it('maps sentences and tokens, nulling headPosition for the root', () => {
    const s = sentence([
      {
        text: 'Swimming',
        lemma: 'swimming',
        pos: 'NOUN',
        tag: 'NN',
        dep: 'nsubj',
        head: 1,
      },
      { text: 'is', lemma: 'be', pos: 'AUX', tag: 'VBZ', dep: 'ROOT', head: 1 },
      { text: 'good', pos: 'ADJ', tag: 'JJ', dep: 'acomp', head: 1 },
      { text: '.', pos: 'PUNCT', tag: '.', dep: 'punct', head: 1 },
    ]);
    const result: NlpParseResult = { sentences: [s] };

    const [built] = buildSentences(s.text, result);

    expect(built.position).toBe(0);
    expect(built.rawText).toBe(s.text);
    expect(built.charStart).toBe(0);
    expect(built.charEnd).toBe(s.text.length);
    expect(built.tokens[0]).toMatchObject({
      position: 0,
      text: 'Swimming',
      lemma: 'swimming',
      pos: 'NOUN',
      tag: 'NN',
      dep: 'nsubj',
      headPosition: 1,
    });
    // token 1 ("is") is its own head -> root -> null
    expect(built.tokens[1].headPosition).toBeNull();
  });

  it('offsets a second sentence within the flattened unit text', () => {
    const s1 = sentence(
      [
        {
          text: 'Reading',
          lemma: 'read',
          pos: 'VERB',
          tag: 'VBG',
          dep: 'nsubj',
          head: 1,
        },
        {
          text: 'is',
          lemma: 'be',
          pos: 'AUX',
          tag: 'VBZ',
          dep: 'ROOT',
          head: 1,
        },
        { text: 'fundamental', pos: 'ADJ', tag: 'JJ', dep: 'acomp', head: 1 },
        { text: '.', pos: 'PUNCT', tag: '.', dep: 'punct', head: 1 },
      ],
      0,
    );
    const s2 = sentence(
      [
        {
          text: 'Swimming',
          lemma: 'swimming',
          pos: 'NOUN',
          tag: 'NN',
          dep: 'nsubj',
          head: 1,
        },
        {
          text: 'helps',
          lemma: 'help',
          pos: 'VERB',
          tag: 'VBZ',
          dep: 'ROOT',
          head: 1,
        },
        { text: '.', pos: 'PUNCT', tag: '.', dep: 'punct', head: 1 },
      ],
      s1.text.length + 1,
    );
    const unitText = `${s1.text} ${s2.text}`;

    const built = buildSentences(unitText, { sentences: [s1, s2] });

    expect(built).toHaveLength(2);
    expect(built[1].position).toBe(1);
    expect(unitText.slice(built[1].charStart, built[1].charEnd)).toBe(s2.text);
  });

  it('throws NlpOffsetMismatchError when a sentence slice does not match', () => {
    const s = sentence([
      { text: 'Hi', pos: 'INTJ', tag: 'UH', dep: 'ROOT', head: 0 },
    ]);

    expect(() =>
      buildSentences('completely different unit text', { sentences: [s] }),
    ).toThrow(NlpOffsetMismatchError);
  });

  it('throws NlpOffsetMismatchError when a token slice does not match', () => {
    const s = sentence([
      { text: 'Hello', pos: 'INTJ', tag: 'UH', dep: 'ROOT', head: 0 },
      { text: 'world', pos: 'NOUN', tag: 'NN', dep: 'npadvmod', head: 0 },
    ]);
    // corrupt the first token's offsets
    s.tokens[0] = { ...s.tokens[0], end: s.tokens[0].end + 3 };

    expect(() => buildSentences(s.text, { sentences: [s] })).toThrow(
      NlpOffsetMismatchError,
    );
  });
});

describe('detectGerund', () => {
  function gerundOf(specs: Parameters<typeof tokens>[0], at: number): boolean {
    const { list } = tokens(specs);
    return detectGerund(list[at], list);
  }

  it('flags a bare -ing subject tagged NN with no determiner ("Swimming is good")', () => {
    expect(
      gerundOf(
        [
          { text: 'Swimming', tag: 'NN', pos: 'NOUN', dep: 'nsubj', head: 1 },
          { text: 'is', tag: 'VBZ', pos: 'AUX', dep: 'ROOT', head: 1 },
          { text: 'good', tag: 'JJ', pos: 'ADJ', dep: 'acomp', head: 1 },
        ],
        0,
      ),
    ).toBe(true);
  });

  it('flags a VBG in a nominal slot ("Reading is fundamental")', () => {
    expect(
      gerundOf(
        [
          { text: 'Reading', tag: 'VBG', pos: 'VERB', dep: 'nsubj', head: 1 },
          { text: 'is', tag: 'VBZ', pos: 'AUX', dep: 'ROOT', head: 1 },
        ],
        0,
      ),
    ).toBe(true);
  });

  it('does not flag an -ing NN that has its own determiner ("the building is tall")', () => {
    expect(
      gerundOf(
        [
          { text: 'The', tag: 'DT', pos: 'DET', dep: 'det', head: 1 },
          { text: 'building', tag: 'NN', pos: 'NOUN', dep: 'nsubj', head: 2 },
          { text: 'is', tag: 'VBZ', pos: 'AUX', dep: 'ROOT', head: 2 },
          { text: 'tall', tag: 'JJ', pos: 'ADJ', dep: 'acomp', head: 2 },
        ],
        1,
      ),
    ).toBe(false);
  });

  it('does not flag a VBG used verbally ("He kept talking")', () => {
    expect(
      gerundOf(
        [
          { text: 'He', tag: 'PRP', pos: 'PRON', dep: 'nsubj', head: 1 },
          { text: 'kept', tag: 'VBD', pos: 'VERB', dep: 'ROOT', head: 1 },
          { text: 'talking', tag: 'VBG', pos: 'VERB', dep: 'xcomp', head: 1 },
        ],
        2,
      ),
    ).toBe(false);
  });

  it('does not flag a lexicalised -ing noun tagged NN ("Morning comes early")', () => {
    expect(
      gerundOf(
        [
          { text: 'Morning', tag: 'NN', pos: 'NOUN', dep: 'nsubj', head: 1 },
          { text: 'comes', tag: 'VBZ', pos: 'VERB', dep: 'ROOT', head: 1 },
          { text: 'early', tag: 'RB', pos: 'ADV', dep: 'advmod', head: 1 },
        ],
        0,
      ),
    ).toBe(false);
  });

  it('does not flag "Nothing" ("Nothing matters")', () => {
    expect(
      gerundOf(
        [
          { text: 'Nothing', tag: 'NN', pos: 'NOUN', dep: 'nsubj', head: 1 },
          { text: 'matters', tag: 'VBZ', pos: 'VERB', dep: 'ROOT', head: 1 },
        ],
        0,
      ),
    ).toBe(false);
  });

  it('still flags a stop-listed lemma when spaCy tags it VBG ("Meeting new people is fun")', () => {
    expect(
      gerundOf(
        [
          { text: 'Meeting', tag: 'VBG', pos: 'VERB', dep: 'nsubj', head: 4 },
          { text: 'new', tag: 'JJ', pos: 'ADJ', dep: 'amod', head: 2 },
          { text: 'people', tag: 'NNS', pos: 'NOUN', dep: 'dobj', head: 0 },
          { text: 'is', tag: 'VBZ', pos: 'AUX', dep: 'ROOT', head: 4 },
          { text: 'fun', tag: 'NN', pos: 'NOUN', dep: 'attr', head: 3 },
        ],
        0,
      ),
    ).toBe(true);
  });

  it('does not flag a non -ing token', () => {
    expect(
      gerundOf(
        [{ text: 'cats', tag: 'NNS', pos: 'NOUN', dep: 'nsubj', head: 0 }],
        0,
      ),
    ).toBe(false);
  });
});

describe('computePhrasalVerbKeys', () => {
  it('groups a discontinuous phrasal verb by the verb lemma and particle ("picked ... up")', () => {
    const { list } = tokens([
      { text: 'She', tag: 'PRP', pos: 'PRON', dep: 'nsubj', head: 1 },
      {
        text: 'picked',
        lemma: 'pick',
        tag: 'VBD',
        pos: 'VERB',
        dep: 'ROOT',
        head: 1,
      },
      { text: 'her', tag: 'PRP$', pos: 'PRON', dep: 'poss', head: 3 },
      { text: 'sister', tag: 'NN', pos: 'NOUN', dep: 'dobj', head: 1 },
      { text: 'up', tag: 'RP', pos: 'ADP', dep: 'prt', head: 1 },
      { text: 'from', tag: 'IN', pos: 'ADP', dep: 'prep', head: 1 },
      { text: 'school', tag: 'NN', pos: 'NOUN', dep: 'pobj', head: 5 },
    ]);

    const keys = computePhrasalVerbKeys(list);

    expect(keys[1]).toBe('pick up');
    expect(keys[4]).toBe('pick up');
    expect(keys[0]).toBeNull();
    expect(keys[3]).toBeNull();
    expect(keys[6]).toBeNull();
  });

  it('only groups a particle when its head is a verb', () => {
    const { list } = tokens([
      {
        text: 'come',
        lemma: 'come',
        tag: 'VB',
        pos: 'VERB',
        dep: 'ROOT',
        head: 0,
      },
      { text: 'on', tag: 'RP', pos: 'ADP', dep: 'prt', head: 0 },
    ]);
    // head is a verb -> grouped
    expect(computePhrasalVerbKeys(list)[0]).toBe('come on');

    const orphan = tokens([
      { text: 'here', tag: 'RB', pos: 'ADV', dep: 'advmod', head: 0 },
      { text: 'up', tag: 'RP', pos: 'ADP', dep: 'prt', head: 0 },
    ]).list;
    expect(computePhrasalVerbKeys(orphan)).toEqual([null, null]);
  });
});
