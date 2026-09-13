import { CefrLevel } from '../../post/enums/cefr-level.enum.js';
import { Disposition } from '../enums/disposition.enum.js';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import {
  EffectiveState,
  resolveEffectiveState,
} from './resolve-effective-state.js';

describe('resolveEffectiveState', () => {
  it('is New with no card, no disposition, and no CEFR default', () => {
    expect(resolveEffectiveState({ userCefrLevel: CefrLevel.A1 })).toBe(
      EffectiveState.New,
    );
  });

  it('is Learning for a fresh card regardless of its FSRS state', () => {
    expect(
      resolveEffectiveState({
        card: { state: LearningCardState.New, scheduledDays: 0 },
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Learning);
  });

  it('is Learned for a Review card scheduled a year or more out', () => {
    expect(
      resolveEffectiveState({
        card: { state: LearningCardState.Review, scheduledDays: 365 },
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Learned);
  });

  it('is Learning for a Review card scheduled under a year out', () => {
    expect(
      resolveEffectiveState({
        card: { state: LearningCardState.Review, scheduledDays: 364 },
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Learning);
  });

  it('prefers an active card over a stored disposition', () => {
    expect(
      resolveEffectiveState({
        card: { state: LearningCardState.Learning, scheduledDays: 3 },
        disposition: Disposition.Skipped,
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Learning);
  });

  it('maps a Known disposition to Learned', () => {
    expect(
      resolveEffectiveState({
        disposition: Disposition.Known,
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Learned);
  });

  it('maps a Skipped disposition to Skipped', () => {
    expect(
      resolveEffectiveState({
        disposition: Disposition.Skipped,
        userCefrLevel: CefrLevel.A1,
      }),
    ).toBe(EffectiveState.Skipped);
  });

  it('prefers a disposition over the CEFR default', () => {
    expect(
      resolveEffectiveState({
        disposition: Disposition.Skipped,
        targetCefrLevel: CefrLevel.A1,
        userCefrLevel: CefrLevel.C2,
      }),
    ).toBe(EffectiveState.Skipped);
  });

  it('is Learned when the target CEFR level is at or below the learner level', () => {
    expect(
      resolveEffectiveState({
        targetCefrLevel: CefrLevel.A2,
        userCefrLevel: CefrLevel.A2,
      }),
    ).toBe(EffectiveState.Learned);
  });

  it('is New when the target CEFR level is above the learner level', () => {
    expect(
      resolveEffectiveState({
        targetCefrLevel: CefrLevel.C1,
        userCefrLevel: CefrLevel.A2,
      }),
    ).toBe(EffectiveState.New);
  });

  it('is New when the target has no CEFR level classified yet', () => {
    expect(
      resolveEffectiveState({
        targetCefrLevel: null,
        userCefrLevel: CefrLevel.C2,
      }),
    ).toBe(EffectiveState.New);
  });
});
