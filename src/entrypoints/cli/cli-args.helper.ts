import { InvalidCliFlagError } from './invalid-cli-flag.error.js';

export function parseCommaSeparated(val: string, flag: string): string[] {
  const entries = val
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (entries.length === 0) {
    throw new InvalidCliFlagError(flag);
  }

  return entries;
}
