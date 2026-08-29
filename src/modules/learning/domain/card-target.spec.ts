import { InvalidCardTargetError } from '../errors/invalid-card-target.error.js';
import { resolveCardTarget } from './card-target.js';

describe('resolveCardTarget', () => {
  it('resolves a word target', () => {
    expect(resolveCardTarget({ wordId: 'w1' })).toEqual({
      type: 'word',
      id: 'w1',
    });
  });

  it('resolves a phrase target', () => {
    expect(resolveCardTarget({ phraseId: 'p1' })).toEqual({
      type: 'phrase',
      id: 'p1',
    });
  });

  it('resolves a grammar target', () => {
    expect(resolveCardTarget({ grammarUsagePointId: 'g1' })).toEqual({
      type: 'grammar',
      id: 'g1',
    });
  });

  it('ignores null / undefined ids', () => {
    expect(resolveCardTarget({ wordId: 'w1', phraseId: null })).toEqual({
      type: 'word',
      id: 'w1',
    });
  });

  it('throws when no target is given', () => {
    expect(() => resolveCardTarget({})).toThrow(InvalidCardTargetError);
  });

  it('throws when more than one target is given', () => {
    expect(() =>
      resolveCardTarget({ wordId: 'w1', grammarUsagePointId: 'g1' }),
    ).toThrow(InvalidCardTargetError);
  });
});
