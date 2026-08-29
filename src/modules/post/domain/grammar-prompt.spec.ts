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
});
