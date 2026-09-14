import { EffectiveState } from '../../learning/domain/resolve-effective-state.js';
import { mostAdvancedEffectiveState } from './effective-state-priority.js';

describe('mostAdvancedEffectiveState', () => {
  it('returns New for no usage points', () => {
    expect(mostAdvancedEffectiveState([])).toBe(EffectiveState.New);
  });

  it('returns Learned over Learning', () => {
    expect(
      mostAdvancedEffectiveState([
        EffectiveState.Learning,
        EffectiveState.Learned,
      ]),
    ).toBe(EffectiveState.Learned);
  });

  it('returns Learning over Skipped', () => {
    expect(
      mostAdvancedEffectiveState([
        EffectiveState.Skipped,
        EffectiveState.Learning,
      ]),
    ).toBe(EffectiveState.Learning);
  });

  it('returns Skipped over New', () => {
    expect(
      mostAdvancedEffectiveState([EffectiveState.New, EffectiveState.Skipped]),
    ).toBe(EffectiveState.Skipped);
  });
});
