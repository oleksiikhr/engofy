import { isHttpUrl, toUrl } from './url.helper.js';

describe('toUrl', () => {
  it('parses a valid URL', () => {
    const url = toUrl('https://example.com/path');

    expect(url).toBeInstanceOf(URL);
    expect(url?.href).toBe('https://example.com/path');
  });

  it('returns null for an invalid URL', () => {
    expect(toUrl('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(toUrl('')).toBeNull();
  });
});

describe('isHttpUrl', () => {
  it('returns true for an http URL', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('returns true for an https URL', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
  });

  it('returns false for a non-http protocol', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false);
  });

  it('returns false for an invalid URL', () => {
    expect(isHttpUrl('not a url')).toBe(false);
  });
});
