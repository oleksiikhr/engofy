import { CefrLevel } from '../enums/cefr-level.enum.js';
import {
  buildComplexityUserText,
  type ComplexityAssessment,
  indexComplexityLevels,
} from './complexity-prompt.js';

describe('buildComplexityUserText', () => {
  it('numbers each sentence on its own line', () => {
    expect(
      buildComplexityUserText(['First one.', 'Second one.', 'Third.']),
    ).toBe('[0] First one.\n[1] Second one.\n[2] Third.');
  });
});

describe('indexComplexityLevels', () => {
  const assessment = (
    sentences: ComplexityAssessment['sentences'],
  ): ComplexityAssessment => ({
    overall: CefrLevel.B1,
    newVocabRatio: 0.1,
    sentences,
  });

  it('returns levels positionally for a full, in-order assessment', () => {
    expect(
      indexComplexityLevels(
        assessment([
          { index: 0, level: CefrLevel.A2 },
          { index: 1, level: CefrLevel.B2 },
        ]),
        2,
      ),
    ).toEqual([CefrLevel.A2, CefrLevel.B2]);
  });

  it('tolerates out-of-order indexes', () => {
    expect(
      indexComplexityLevels(
        assessment([
          { index: 2, level: CefrLevel.C1 },
          { index: 0, level: CefrLevel.A1 },
          { index: 1, level: CefrLevel.B1 },
        ]),
        3,
      ),
    ).toEqual([CefrLevel.A1, CefrLevel.B1, CefrLevel.C1]);
  });

  it('throws when an index is out of range', () => {
    expect(() =>
      indexComplexityLevels(
        assessment([
          { index: 0, level: CefrLevel.A1 },
          { index: 5, level: CefrLevel.A1 },
        ]),
        2,
      ),
    ).toThrow('out of range');
  });

  it('throws when an index is repeated', () => {
    expect(() =>
      indexComplexityLevels(
        assessment([
          { index: 0, level: CefrLevel.A1 },
          { index: 0, level: CefrLevel.B1 },
        ]),
        2,
      ),
    ).toThrow('twice');
  });

  it('throws when not every sentence is covered', () => {
    expect(() =>
      indexComplexityLevels(assessment([{ index: 0, level: CefrLevel.A1 }]), 3),
    ).toThrow('covered 1 of 3');
  });
});
