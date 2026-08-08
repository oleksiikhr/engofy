export function valueOr<T>(value: T | undefined, fallback: T | (() => T)): T;

export function valueOr<TInput, TOutput>(
  value: TInput | null | undefined,
  fallback: TOutput | (() => TOutput),
  map: (v: Exclude<TInput, null | undefined>) => TOutput,
): TOutput;

export function valueOr<TInput, TOutput>(
  value: TInput | null | undefined,
  fallback: TOutput | (() => TOutput),
  map?: (v: Exclude<TInput, null | undefined>) => TOutput,
): TOutput {
  if (value === undefined) {
    return typeof fallback === 'function'
      ? (fallback as () => TOutput)()
      : fallback;
  }

  if (value === null) {
    return value as TOutput;
  }

  return map
    ? map(value as Exclude<TInput, null | undefined>)
    : (value as TOutput);
}
