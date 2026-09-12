import { LearningCardState } from '../../learning/enums/learning-card-state.enum.js';
import { mostAdvancedState } from './learning-card-state-priority.js';

describe('mostAdvancedState', () => {
  it('returns New for no cards', () => {
    expect(mostAdvancedState([])).toBe(LearningCardState.New);
  });

  it('returns Review over Learning', () => {
    expect(
      mostAdvancedState([LearningCardState.Learning, LearningCardState.Review]),
    ).toBe(LearningCardState.Review);
  });

  it('treats Learning and Relearning as equally advanced', () => {
    expect(
      mostAdvancedState([LearningCardState.Relearning, LearningCardState.New]),
    ).toBe(LearningCardState.Relearning);
  });
});
