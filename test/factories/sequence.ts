const counters = new Map<string, number>();

// Deterministic per-key counter for unique-constrained defaults (email,
// slug, …). Never reset: the DB is rolled back per test, but a counter that
// keeps climbing can never collide across tests in one worker.
export function nextSeq(key: string): number {
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return next;
}
