import { CEFR_LEVELS } from './posts-list';
import type { CefrLevel } from './types';

// A guest's own level. It lives in a cookie, not localStorage, because the
// reader page picks its highlights while rendering on the server. `skip` means
// the guest dismissed the level question; it leaves the level unset.
export const LEVEL_COOKIE = 'reader-level';
export const LEVEL_SKIPPED = 'skip';
const ONE_YEAR = 60 * 60 * 24 * 365;

export type LevelChoice = CefrLevel | typeof LEVEL_SKIPPED;

export function parseLevelChoice(raw: string | null | undefined) {
  if (raw === LEVEL_SKIPPED) {
    return LEVEL_SKIPPED;
  }
  return (CEFR_LEVELS as string[]).includes(raw ?? '')
    ? (raw as CefrLevel)
    : null;
}

export function writeLevelChoice(choice: LevelChoice): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the server must see the choice on the next request; Cookie Store API lacks wide support.
  document.cookie = `${LEVEL_COOKIE}=${choice}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

// The guest's level and its neighbours (A2 → A2, B1 and A1 → A1, A2): texts one
// step easier or harder still read well. Empty when no level was picked.
export function levelRange(level: CefrLevel | null): CefrLevel[] {
  if (!level) {
    return [];
  }
  const at = CEFR_LEVELS.indexOf(level);
  return CEFR_LEVELS.slice(Math.max(0, at - 1), at + 2);
}

// The level a page should tailor its text lists to: the picked level from the
// cookie (a skipped question leaves it unset).
export function pickedLevel(cookieValue: string | undefined): CefrLevel | null {
  const choice = parseLevelChoice(cookieValue);
  return choice === LEVEL_SKIPPED ? null : choice;
}
