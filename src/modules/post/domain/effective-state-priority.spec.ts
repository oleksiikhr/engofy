import { EffectiveState } from '../../learning/domain/resolve-effective-state.js';
import {
  collapseConstructionState,
  countResolved,
} from './effective-state-priority.js';

const { New, Learning, Learned, Skipped } = EffectiveState;

describe('collapseConstructionState', () => {
  it('is New for no usage points', () => {
    expect(collapseConstructionState([])).toBe(New);
  });

  it('is New when no point was touched', () => {
    expect(collapseConstructionState([New, New])).toBe(New);
  });

  it('is Learning when any point has an active card', () => {
    expect(collapseConstructionState([Learning, New])).toBe(Learning);
    expect(collapseConstructionState([Learning, Learned])).toBe(Learning);
  });

  it('is Learning when only some points are resolved', () => {
    expect(collapseConstructionState([Learned, New])).toBe(Learning);
    expect(collapseConstructionState([Skipped, New])).toBe(Learning);
  });

  it('is Learned when every point is Learned or Skipped', () => {
    expect(collapseConstructionState([Learned, Learned])).toBe(Learned);
    expect(collapseConstructionState([Learned, Skipped])).toBe(Learned);
  });

  it('is Skipped when every point is Skipped', () => {
    expect(collapseConstructionState([Skipped, Skipped])).toBe(Skipped);
  });
});

describe('countResolved', () => {
  it('counts Learned and Skipped points only', () => {
    expect(countResolved([Learned, Skipped, Learning, New])).toBe(2);
    expect(countResolved([])).toBe(0);
  });
});
