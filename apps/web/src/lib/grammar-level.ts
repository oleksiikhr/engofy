import type { CefrLevel } from './types';

const ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Rules up to this level are shown up front on a grammar page; harder ones sit
// behind a fold. Fixed for everyone: the page has no learner level to compare.
const BASE_LEVEL: CefrLevel = 'B1';

export function isHardLevel(level: CefrLevel): boolean {
  return ORDER.indexOf(level) > ORDER.indexOf(BASE_LEVEL);
}
