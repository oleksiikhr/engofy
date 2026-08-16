import {
  generateOtp,
  generateToken,
  hashSecret,
  normalizeEmail,
  timingSafeEqualHex,
} from './token.helper.js';

const URL_SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const SIX_DIGIT_OTP_PATTERN = /^\d{6}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

describe('generateToken', () => {
  it('returns a URL-safe string with no padding/plus/slash characters', () => {
    const token = generateToken();

    expect(token).toMatch(URL_SAFE_TOKEN_PATTERN);
  });

  it('returns a different value on each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('generateOtp', () => {
  it('returns a zero-padded 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(SIX_DIGIT_OTP_PATTERN);
    }
  });
});

describe('hashSecret', () => {
  it('is deterministic for the same input', () => {
    expect(hashSecret('abc123')).toBe(hashSecret('abc123'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashSecret('abc123')).not.toBe(hashSecret('abc124'));
  });

  it('produces a 64-character hex string (sha256)', () => {
    expect(hashSecret('abc123')).toMatch(SHA256_HEX_PATTERN);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims the address', () => {
    expect(normalizeEmail('  User@Example.com  ')).toBe('user@example.com');
  });
});

describe('timingSafeEqualHex', () => {
  it('returns true for equal hex strings', () => {
    const hash = hashSecret('same-value');

    expect(timingSafeEqualHex(hash, hash)).toBe(true);
  });

  it('returns false for different hex strings of equal length', () => {
    expect(timingSafeEqualHex(hashSecret('a'), hashSecret('b'))).toBe(false);
  });

  it('returns false for different-length inputs instead of throwing', () => {
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });
});
