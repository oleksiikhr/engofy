// Every char range in the annotation pipeline is a half-open interval
// `[start, end)`: `end` is one past the last covered char, so two ranges that
// merely touch (`a.end === b.start`) neither overlap nor contain each other.
export interface SpanRange {
  start: number;
  end: number;
}

// True when `a` and `b` share at least one char position.
export function spansOverlap(a: SpanRange, b: SpanRange): boolean {
  return a.start < b.end && b.start < a.end;
}

// True when `inner` sits entirely inside `outer` (coincident edges allowed).
export function contains(outer: SpanRange, inner: SpanRange): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}
