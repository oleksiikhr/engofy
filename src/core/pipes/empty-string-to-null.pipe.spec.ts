import { Reflector } from '@nestjs/core';
import { NO_EMPTY_TO_NULL_KEY } from '../decorators/no-empty-to-null.decorator.js';
import { EmptyStringToNullPipe } from './empty-string-to-null.pipe.js';

describe('EmptyStringToNullPipe', () => {
  let pipe: EmptyStringToNullPipe;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    pipe = new EmptyStringToNullPipe(reflector);
  });

  it('should return null for empty string', () => {
    expect(pipe.transform('', { type: 'body' })).toBeNull();
    expect(pipe.transform('   ', { type: 'body' })).toBeNull();
  });

  it('should trim non-empty strings', () => {
    expect(pipe.transform('  hello  ', { type: 'body' })).toBe('hello');
  });

  it('should return non-string values as is', () => {
    expect(pipe.transform(123, { type: 'body' })).toBe(123);
    expect(pipe.transform(true, { type: 'body' })).toBe(true);
    expect(pipe.transform(null, { type: 'body' })).toBeNull();
    expect(pipe.transform(undefined, { type: 'body' })).toBeUndefined();
  });

  it('should handle nested objects', () => {
    const input = {
      a: '',
      b: '  text ',
      c: {
        d: '   ',
        e: 'ok',
      },
    };
    const expected = {
      a: null,
      b: 'text',
      c: {
        d: null,
        e: 'ok',
      },
    };

    expect(pipe.transform(input, { type: 'body' })).toEqual(expected);
  });

  it('should handle arrays', () => {
    const input = ['', ' hello ', '   ', 123, null];
    const expected = [null, 'hello', null, 123, null];

    expect(pipe.transform(input, { type: 'body' })).toEqual(expected);
  });

  it('should respect excluded fields via decorator', () => {
    class TestDto {
      field1!: string;
      field2!: string;
    }

    vi.spyOn(reflector, 'get').mockReturnValue(['field1']); // exclude field1

    const input = { field1: '', field2: '' };
    const expected = { field1: '', field2: null };

    expect(pipe.transform(input, { type: 'body', metatype: TestDto })).toEqual(
      expected,
    );
    expect(reflector.get).toHaveBeenCalledWith(NO_EMPTY_TO_NULL_KEY, TestDto);
  });

  it('should handle nested excluded paths', () => {
    class TestDto {
      nested!: { keep: string; convert: string };
    }

    vi.spyOn(reflector, 'get').mockReturnValue(['nested.keep']); // exclude nested.keep

    const input = { nested: { keep: '', convert: '' } };
    const expected = { nested: { keep: '', convert: null } };

    expect(pipe.transform(input, { type: 'body', metatype: TestDto })).toEqual(
      expected,
    );
  });

  it('should skip entire array if path is excluded', () => {
    class TestDto {
      body!: { a: string; b: string; c: number }[];
    }

    vi.spyOn(reflector, 'get').mockReturnValue(['body']);

    const payload = { body: [{ a: '', b: '', c: 123 }] };
    const result = pipe.transform(payload, { type: 'body', metatype: TestDto });

    expect(result).toEqual(payload);
  });
});
