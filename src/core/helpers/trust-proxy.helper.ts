export function parseTrustProxy(
  raw: string | undefined,
): boolean | string | string[] {
  if (!raw) {
    return [];
  }

  const tokens = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 1) {
    if (tokens[0].toLowerCase() === 'true') {
      return true;
    }

    if (tokens[0].toLowerCase() === 'false') {
      return false;
    }
  }

  return tokens;
}
