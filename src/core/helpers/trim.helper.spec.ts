import { ltrim, rtrim, trim } from './trim.helper.js';

describe('trim functions', () => {
  describe('ltrim', () => {
    it('removes characters from start', () => {
      expect(ltrim('///test///', '/')).toBe('test///');
      expect(ltrim('abcabcHelloabc', 'abc')).toBe('Helloabc');
    });

    it('removes mixed character set', () => {
      expect(ltrim('abccbaHello', 'abc')).toBe('Hello');
    });

    it('does nothing if no match', () => {
      expect(ltrim('hello', 'x')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(ltrim('', '/')).toBe('');
    });

    it('removes emoji from start', () => {
      expect(ltrim('🙂🙂hello🙂', '🙂')).toBe('hello🙂');
    });

    it('handles full removal', () => {
      expect(ltrim('abc', 'abc')).toBe('');
    });

    it('does nothing with empty chars', () => {
      expect(ltrim('hello', '')).toBe('hello');
    });
  });

  describe('rtrim', () => {
    it('removes characters from end', () => {
      expect(rtrim('///test///', '/')).toBe('///test');
      expect(rtrim('abcHelloabcabc', 'abc')).toBe('abcHello');
    });

    it('removes mixed character set', () => {
      expect(rtrim('Helloabccba', 'abc')).toBe('Hello');
    });

    it('does nothing if no match', () => {
      expect(rtrim('hello', 'x')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(rtrim('', '/')).toBe('');
    });

    it('removes emoji from end', () => {
      expect(rtrim('🙂hello🙂🙂', '🙂')).toBe('🙂hello');
    });

    it('handles full removal', () => {
      expect(rtrim('abc', 'abc')).toBe('');
    });

    it('does nothing with empty chars', () => {
      expect(rtrim('hello', '')).toBe('hello');
    });
  });

  describe('trim', () => {
    it('removes characters from both sides', () => {
      expect(trim('///test///', '/')).toBe('test');
    });

    it('removes mixed character set', () => {
      expect(trim('abccbaHellocab', 'abc')).toBe('Hello');
    });

    it('does nothing if no match', () => {
      expect(trim('hello', 'x')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(trim('', '/')).toBe('');
    });

    it('handles full removal', () => {
      expect(trim('aaa', 'a')).toBe('');
    });

    it('removes emoji from both sides', () => {
      expect(trim('🙂hello🙂', '🙂')).toBe('hello');
    });

    it('does nothing with empty chars', () => {
      expect(trim('hello', '')).toBe('hello');
    });
  });
});
