export function sanitizeEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): T | null {
  return typeof value === 'string' &&
    (allowedValues as readonly string[]).includes(value)
    ? (value as T)
    : null;
}
