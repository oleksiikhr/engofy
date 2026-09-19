import type { EffectiveState } from './types';

export const STATE_LABEL: Record<EffectiveState, string> = {
  new: 'New',
  learning: 'Learning',
  learned: 'Learned',
  skipped: 'Skipped',
};

// Tone class (app.css) for a state's `.tag`.
export const STATE_TONE: Record<EffectiveState, string> = {
  new: 'tone-blue',
  learning: 'tone-amber',
  learned: 'tone-green',
  skipped: 'tag--muted',
};
