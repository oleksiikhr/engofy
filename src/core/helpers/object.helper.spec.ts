import { isRecord } from './object.helper.js';

describe('isRecord', () => {
  describe('should return true for plain objects', () => {
    it('returns true for empty object', () => {
      expect(isRecord({})).toBe(true);
    });

    it('returns true for object with properties', () => {
      expect(isRecord({ a: 1, b: 'test' })).toBe(true);
    });

    it('returns true for object created via Object.create(null)', () => {
      const obj = Object.create(null);
      obj.a = 1;

      expect(isRecord(obj)).toBe(true);
    });
  });

  describe('should return false for non-objects', () => {
    it('returns false for null', () => {
      expect(isRecord(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isRecord(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isRecord('test')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isRecord(123)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isRecord(true)).toBe(false);
    });

    it('returns false for symbol', () => {
      expect(isRecord(Symbol('x'))).toBe(false);
    });

    it('returns false for bigint', () => {
      expect(isRecord(BigInt(10))).toBe(false);
    });
  });

  describe('should return false for arrays', () => {
    it('returns false for empty array', () => {
      expect(isRecord([])).toBe(false);
    });

    it('returns false for array with values', () => {
      expect(isRecord([1, 2, 3])).toBe(false);
    });
  });
});
