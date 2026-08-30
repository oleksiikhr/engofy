import { z } from 'zod';

// `EmptyStringToNullPipe` rewrites a blank query param (`?limit=`, `?cefr=`) to
// `null` before validation runs. Wrap a query field with this so `null` / `''`
// collapse to `undefined` — then the field's own `.default()` / `.optional()`
// applies instead of `z.coerce` seeing `null`, coercing it to `0`/`NaN`, and
// 400-ing a request that just left the param blank.
export function queryParam<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) =>
      value === null || value === '' || value === undefined ? undefined : value,
    schema,
  );
}
