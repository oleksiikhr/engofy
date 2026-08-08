import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  envBool,
  envEnum,
  envNumber,
  envRequiredString,
  envString,
  envStringList,
} from './env.helper.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('envBool', () => {
  it('returns fallback when unset', () => {
    vi.stubEnv('ENV_BOOL_TEST', undefined);
    expect(envBool('ENV_BOOL_TEST')).toBe(false);
    expect(envBool('ENV_BOOL_TEST', true)).toBe(true);
  });

  it('returns true for "true" and "1"', () => {
    vi.stubEnv('ENV_BOOL_TEST', 'true');
    expect(envBool('ENV_BOOL_TEST')).toBe(true);

    vi.stubEnv('ENV_BOOL_TEST', '1');
    expect(envBool('ENV_BOOL_TEST')).toBe(true);
  });

  it('is case-insensitive', () => {
    vi.stubEnv('ENV_BOOL_TEST', 'TRUE');
    expect(envBool('ENV_BOOL_TEST')).toBe(true);
  });

  it('returns false for "false" and "0"', () => {
    vi.stubEnv('ENV_BOOL_TEST', 'false');
    expect(envBool('ENV_BOOL_TEST', true)).toBe(false);

    vi.stubEnv('ENV_BOOL_TEST', '0');
    expect(envBool('ENV_BOOL_TEST', true)).toBe(false);
  });

  it('returns fallback for an unrecognised value', () => {
    vi.stubEnv('ENV_BOOL_TEST', 'yes');
    expect(envBool('ENV_BOOL_TEST', true)).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('ENV_BOOL_TEST', '  true  ');
    expect(envBool('ENV_BOOL_TEST')).toBe(true);
  });
});

describe('envNumber', () => {
  it('returns fallback when unset or empty', () => {
    vi.stubEnv('ENV_NUMBER_TEST', undefined);
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(3000);

    vi.stubEnv('ENV_NUMBER_TEST', '');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(3000);
  });

  it('returns undefined when unset or empty and no fallback is given', () => {
    vi.stubEnv('ENV_NUMBER_TEST', undefined);
    expect(envNumber('ENV_NUMBER_TEST')).toBeUndefined();

    vi.stubEnv('ENV_NUMBER_TEST', '');
    expect(envNumber('ENV_NUMBER_TEST')).toBeUndefined();
  });

  it('parses a valid numeric string', () => {
    vi.stubEnv('ENV_NUMBER_TEST', '42');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(42);
    expect(envNumber('ENV_NUMBER_TEST')).toBe(42);
  });

  it('returns an explicit 0 rather than the fallback', () => {
    vi.stubEnv('ENV_NUMBER_TEST', '0');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(0);
  });

  it('returns fallback for a non-numeric value', () => {
    vi.stubEnv('ENV_NUMBER_TEST', 'not-a-number');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(3000);
  });

  it('returns undefined for a non-numeric value and no fallback is given', () => {
    vi.stubEnv('ENV_NUMBER_TEST', 'not-a-number');
    expect(envNumber('ENV_NUMBER_TEST')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('ENV_NUMBER_TEST', '  42  ');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(42);
  });

  it('returns fallback for a whitespace-only value', () => {
    vi.stubEnv('ENV_NUMBER_TEST', '   ');
    expect(envNumber('ENV_NUMBER_TEST', 3000)).toBe(3000);
  });
});

describe('envString', () => {
  it('returns fallback when unset', () => {
    vi.stubEnv('ENV_STRING_TEST', undefined);
    expect(envString('ENV_STRING_TEST', 'default')).toBe('default');
  });

  it('returns undefined when unset and no fallback is given', () => {
    vi.stubEnv('ENV_STRING_TEST', undefined);
    expect(envString('ENV_STRING_TEST')).toBeUndefined();
  });

  it('returns the raw value when set', () => {
    vi.stubEnv('ENV_STRING_TEST', 'custom');
    expect(envString('ENV_STRING_TEST', 'default')).toBe('custom');
    expect(envString('ENV_STRING_TEST')).toBe('custom');
  });

  it('returns fallback for an explicit empty string', () => {
    vi.stubEnv('ENV_STRING_TEST', '');
    expect(envString('ENV_STRING_TEST', 'default')).toBe('default');
  });

  it('returns undefined for an explicit empty string and no fallback is given', () => {
    vi.stubEnv('ENV_STRING_TEST', '');
    expect(envString('ENV_STRING_TEST')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('ENV_STRING_TEST', '  custom  ');
    expect(envString('ENV_STRING_TEST', 'default')).toBe('custom');
  });

  it('treats a whitespace-only value as empty and returns the fallback', () => {
    vi.stubEnv('ENV_STRING_TEST', '   ');
    expect(envString('ENV_STRING_TEST', 'default')).toBe('default');
  });
});

describe('envRequiredString', () => {
  it('returns the value when set', () => {
    vi.stubEnv('ENV_REQUIRED_TEST', 'value');
    expect(envRequiredString('ENV_REQUIRED_TEST')).toBe('value');
  });

  it('throws when unset', () => {
    vi.stubEnv('ENV_REQUIRED_TEST', undefined);
    expect(() => envRequiredString('ENV_REQUIRED_TEST')).toThrow(
      'Missing required environment variable: ENV_REQUIRED_TEST',
    );
  });

  it('throws when empty', () => {
    vi.stubEnv('ENV_REQUIRED_TEST', '');
    expect(() => envRequiredString('ENV_REQUIRED_TEST')).toThrow(
      'Missing required environment variable: ENV_REQUIRED_TEST',
    );
  });

  it('throws when whitespace-only', () => {
    vi.stubEnv('ENV_REQUIRED_TEST', '   ');
    expect(() => envRequiredString('ENV_REQUIRED_TEST')).toThrow(
      'Missing required environment variable: ENV_REQUIRED_TEST',
    );
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('ENV_REQUIRED_TEST', '  value  ');
    expect(envRequiredString('ENV_REQUIRED_TEST')).toBe('value');
  });
});

describe('envStringList', () => {
  it('returns fallback when unset', () => {
    vi.stubEnv('ENV_LIST_TEST', undefined);
    expect(envStringList('ENV_LIST_TEST')).toEqual([]);
    expect(envStringList('ENV_LIST_TEST', ['default'])).toEqual(['default']);
  });

  it('splits a comma-separated value', () => {
    vi.stubEnv('ENV_LIST_TEST', '92000000,103644278');
    expect(envStringList('ENV_LIST_TEST')).toEqual(['92000000', '103644278']);
  });

  it('trims whitespace and filters blank tokens', () => {
    vi.stubEnv('ENV_LIST_TEST', ' 92000000 , , 103644278 ');
    expect(envStringList('ENV_LIST_TEST')).toEqual(['92000000', '103644278']);
  });
});

describe('envEnum', () => {
  const ALLOWED = ['a', 'b', 'c'] as const;

  it('returns fallback when unset', () => {
    vi.stubEnv('ENV_ENUM_TEST', undefined);
    expect(envEnum('ENV_ENUM_TEST', ALLOWED, 'a')).toBe('a');
  });

  it('returns the value when it is an allowed member', () => {
    vi.stubEnv('ENV_ENUM_TEST', 'b');
    expect(envEnum('ENV_ENUM_TEST', ALLOWED, 'a')).toBe('b');
  });

  it('throws when the value is not an allowed member', () => {
    vi.stubEnv('ENV_ENUM_TEST', 'z');
    expect(() => envEnum('ENV_ENUM_TEST', ALLOWED, 'a')).toThrow(
      'Invalid value for environment variable ENV_ENUM_TEST: "z". Expected one of: a, b, c',
    );
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('ENV_ENUM_TEST', '  b  ');
    expect(envEnum('ENV_ENUM_TEST', ALLOWED, 'a')).toBe('b');
  });
});
