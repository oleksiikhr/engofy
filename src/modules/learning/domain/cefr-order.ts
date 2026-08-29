import { CefrLevel } from '../../post/enums/cefr-level.enum.js';

// CEFR levels from easiest to hardest.
export const CEFR_LEVELS: readonly CefrLevel[] = [
  CefrLevel.A1,
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
  CefrLevel.C2,
];

export function cefrRank(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

// Easiest level in the list, or null when it is empty.
export function minCefr(levels: readonly CefrLevel[]): CefrLevel | null {
  let min: CefrLevel | null = null;
  for (const level of levels) {
    if (min === null || cefrRank(level) < cefrRank(min)) {
      min = level;
    }
  }
  return min;
}

export function emptyCefrRecord(): Record<CefrLevel, number> {
  return {
    [CefrLevel.A1]: 0,
    [CefrLevel.A2]: 0,
    [CefrLevel.B1]: 0,
    [CefrLevel.B2]: 0,
    [CefrLevel.C1]: 0,
    [CefrLevel.C2]: 0,
  };
}
