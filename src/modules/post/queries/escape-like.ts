// `%` / `_` / `\` typed by the learner must match literally, not as LIKE
// wildcards.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
