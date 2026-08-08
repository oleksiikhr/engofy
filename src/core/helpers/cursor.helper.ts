export type VersionedCursor<V extends number, P> = { v: V; payload: P };

export function encodeCursor<P>(version: number, payload: P): string {
  const cursor: VersionedCursor<number, P> = { v: version, payload };

  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor<P>(
  cursor: string | undefined,
  version: number,
  isPayload: (v: unknown) => v is P,
): P | undefined {
  if (!cursor) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid pagination cursor');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).v !== version ||
    !isPayload((parsed as Record<string, unknown>).payload)
  ) {
    throw new Error('Invalid pagination cursor');
  }

  return (parsed as VersionedCursor<number, P>).payload;
}
