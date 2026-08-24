import { DomainError } from '../../errors/domain.error.js';
import { Url } from '../../value-objects/url.vo.js';
import { UrlType } from './url.type.js';

describe('UrlType', () => {
  const type = new UrlType();

  describe('convertToDatabaseValue', () => {
    it('converts a Url value object to its string representation', () => {
      const url = Url.of('https://example.com');

      expect(type.convertToDatabaseValue(url)).toBe('https://example.com');
    });

    it('returns null for null', () => {
      expect(type.convertToDatabaseValue(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(
        type.convertToDatabaseValue(undefined as unknown as Url | null),
      ).toBeNull();
    });
  });

  describe('convertToJSValue', () => {
    it('parses a stored string into a Url value object', () => {
      const value = type.convertToJSValue('https://example.com');

      expect(value).toBeInstanceOf(Url);
      expect(value?.value).toBe('https://example.com');
    });

    it('returns the same instance when already a Url', () => {
      const url = Url.of('https://example.com');

      expect(type.convertToJSValue(url)).toBe(url);
    });

    it('returns null for null', () => {
      expect(type.convertToJSValue(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(
        type.convertToJSValue(undefined as unknown as string | null),
      ).toBeNull();
    });

    it('throws when the stored value is not a valid URL', () => {
      expect(() => type.convertToJSValue('not a url')).toThrow(DomainError);
    });
  });

  describe('getColumnType', () => {
    it('returns text', () => {
      expect(type.getColumnType()).toBe('text');
    });
  });
});
