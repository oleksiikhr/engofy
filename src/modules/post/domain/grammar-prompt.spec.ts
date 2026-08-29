import { CefrLevel } from '../enums/cefr-level.enum.js';
import {
  buildGrammarCatalog,
  buildGrammarUserText,
  parseGrammarResponse,
} from './grammar-prompt.js';

describe('buildGrammarUserText', () => {
  it('numbers each sentence on its own line', () => {
    expect(buildGrammarUserText(['She left.', 'He stayed.'])).toBe(
      '[0] She left.\n[1] He stayed.',
    );
  });

  it('collapses a hard-wrapped sentence onto one line', () => {
    expect(
      buildGrammarUserText(['the strongest\nresearch support here', 'Next.']),
    ).toBe('[0] the strongest research support here\n[1] Next.');
  });
});

describe('buildGrammarCatalog', () => {
  it('renders a header per construction and a line per usage point', () => {
    const catalog = buildGrammarCatalog([
      {
        slug: 'past-perfect',
        name: 'past perfect',
        usagePoints: [
          {
            egpIndex: 412,
            cefr: CefrLevel.B1,
            guideword: 'USE: BEFORE A PAST EVENT',
            canDoStatement:
              'Can use the past perfect to show one past action before another.',
          },
        ],
      },
    ]);

    expect(catalog).toBe(
      '## past-perfect — past perfect\n' +
        '  [412] B1 USE: BEFORE A PAST EVENT — Can use the past perfect to show one past action before another.',
    );
  });
});

describe('parseGrammarResponse', () => {
  const sentences = [
    'She had never visited Tokyo before.',
    'We will go tomorrow.',
  ];

  it('splits numbered lines and parses each against its sentence', () => {
    const raw =
      '[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.\n' +
      '[1] We ⟦will go⟧{{g|future-will|20}} tomorrow.';

    const result = parseGrammarResponse(sentences, raw);

    expect(result.isComplete).toBe(true);
    expect(result.lines[0].spans[0]).toMatchObject({ slug: 'past-perfect' });
    expect(result.lines[1].spans[0]).toMatchObject({ slug: 'future-will' });
  });

  it('marks incomplete when a sentence line is missing from the response', () => {
    const raw =
      '[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before.';

    const result = parseGrammarResponse(sentences, raw);

    expect(result.isComplete).toBe(false);
    expect(result.lines[1].spans).toEqual([]);
  });

  it('marks incomplete when a line fails its own reconstruct check', () => {
    const raw =
      '[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo.\n' + // dropped "before."
      '[1] We will go tomorrow.';

    expect(parseGrammarResponse(sentences, raw).isComplete).toBe(false);
  });

  it('reconstructs a hard-wrapped sentence and maps spans back to rawText offsets', () => {
    const wrapped = [
      'Spaced repetition and active recall are the two techniques with the\nstrongest research support.',
    ];
    // Model echoes the sentence back collapsed to one line (what it sees).
    const raw =
      '[0] ⟦Spaced repetition and active recall⟧{{g|conjunctions-coordinating|261}}' +
      ' are the two techniques with the strongest research support.';

    const result = parseGrammarResponse(wrapped, raw);

    expect(result.isComplete).toBe(true);
    const span = result.lines[0].spans[0];
    expect(span).toMatchObject({
      slug: 'conjunctions-coordinating',
      egpIndex: 261,
      charStart: 0,
    });
    // Offsets index the original rawText (newline intact).
    expect(wrapped[0].slice(span.charStart, span.charEnd)).toBe(
      'Spaced repetition and active recall',
    );
  });

  it('captures a sentence the model wrapped across physical lines', () => {
    const raw =
      '[0] She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo\nbefore.\n' +
      '[1] We ⟦will go⟧{{g|future-will|20}} tomorrow.';

    const result = parseGrammarResponse(sentences, raw);

    expect(result.isComplete).toBe(true);
    expect(result.lines[0].spans[0]).toMatchObject({ slug: 'past-perfect' });
    expect(result.lines[1].spans[0]).toMatchObject({ slug: 'future-will' });
  });
});
