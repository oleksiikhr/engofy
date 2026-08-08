import { sanitizeEnumValue } from './enum.helper.js';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

describe('sanitizeEnumValue', () => {
  it('returns the value when it is one of the allowed values', () => {
    expect(sanitizeEnumValue('red', Object.values(Color))).toBe('red');
  });

  it('returns null for a value outside the allowed values', () => {
    expect(sanitizeEnumValue('green', Object.values(Color))).toBeNull();
  });

  it('returns null for null', () => {
    expect(sanitizeEnumValue(null, Object.values(Color))).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(sanitizeEnumValue(undefined, Object.values(Color))).toBeNull();
  });

  it('returns null for a non-string value', () => {
    expect(sanitizeEnumValue(42, Object.values(Color))).toBeNull();
    expect(sanitizeEnumValue({}, Object.values(Color))).toBeNull();
  });
});
