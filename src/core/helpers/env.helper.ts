function readEnv(key: string): string | undefined {
  return process.env[key]?.trim();
}

export function envBool(key: string, fallback = false): boolean {
  const value = readEnv(key)?.toLowerCase();

  if (value === undefined) {
    return fallback;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return fallback;
}

function parseNumberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function envNumber<T extends number | undefined = undefined>(
  key: string,
  fallback?: T,
): T extends number ? number : number | undefined {
  const value = readEnv(key);
  const result = value ? (parseNumberOrUndefined(value) ?? fallback) : fallback;

  return result as T extends number ? number : number | undefined;
}

export function envString<T extends string | undefined = undefined>(
  key: string,
  fallback?: T,
): T extends string ? string : string | undefined {
  return (readEnv(key) || fallback) as T extends string
    ? string
    : string | undefined;
}

export function envEnum<T extends string>(
  key: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  const value = readEnv(key);

  if (value === undefined) {
    return fallback;
  }

  if ((allowedValues as readonly string[]).includes(value)) {
    return value as T;
  }

  throw new Error(
    `Invalid value for environment variable ${key}: "${value}". Expected one of: ${allowedValues.join(', ')}`,
  );
}

export function envRequiredString(key: string): string {
  const value = readEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function envStringList(key: string, fallback: string[] = []): string[] {
  const value = readEnv(key);

  if (value === undefined) {
    return fallback;
  }

  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
