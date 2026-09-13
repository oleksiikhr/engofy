import {
  decodeCursor,
  encodeCursor,
} from '../../../../core/helpers/cursor.helper.js';
import { InvalidDictionaryCursorError } from '../../errors/invalid-dictionary-cursor.error.js';

const VERSION = 1;

// The list is paginated by lemma-group, not by raw card/disposition row (a
// word can carry several saved senses under one lemma — see
// `dictionary-view.ts`), sorted by `sortKey` (lowercased primary) then
// `groupId` as a tiebreak for two entries that sort equal.
export interface DictionaryCursorPayload {
  sortKey: string;
  groupType: 'word' | 'phrase';
  groupId: string;
}

function isPayload(value: unknown): value is DictionaryCursorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).sortKey === 'string' &&
    ((value as Record<string, unknown>).groupType === 'word' ||
      (value as Record<string, unknown>).groupType === 'phrase') &&
    typeof (value as Record<string, unknown>).groupId === 'string'
  );
}

export function encodeDictionaryCursor(
  payload: DictionaryCursorPayload,
): string {
  return encodeCursor(VERSION, payload);
}

export function decodeDictionaryCursor(
  cursor: string | undefined,
): DictionaryCursorPayload | undefined {
  try {
    return decodeCursor(cursor, VERSION, isPayload);
  } catch {
    throw new InvalidDictionaryCursorError('Invalid pagination cursor');
  }
}
