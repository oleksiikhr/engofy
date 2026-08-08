import { valueOr } from './value-or.helper.js';

describe('valueOr', () => {
  it('should return fallback only for undefined', () => {
    expect(valueOr(undefined, 5)).toBe(5);
    expect(valueOr(undefined, 'hi')).toBe('hi');
  });

  it('should return null if value is null', () => {
    expect(valueOr(null, 5)).toBe(null);
    expect(valueOr(null, 'fallback')).toBe(null);
  });

  it('should not call map if value is null', () => {
    const map = vi.fn((x: number) => x * 2);

    expect(valueOr(null, 0, map)).toBe(null);
    expect(map).not.toHaveBeenCalled();
  });

  it('should return value if it is not null/undefined', () => {
    expect(valueOr(10, 5)).toBe(10);
    expect(valueOr('test', 'fallback')).toBe('test');
  });

  it('should apply map function if value is defined and not null', () => {
    expect(valueOr(2, 0, (x) => x * 2)).toBe(4);
    expect(valueOr('123', 0, Number)).toBe(123);
  });

  it('should return falsy values that are not null/undefined', () => {
    expect(valueOr(0, 99)).toBe(0);
    expect(valueOr('', 'fallback')).toBe('');
    expect(valueOr(false, true)).toBe(false);
  });

  it('should call fallback callback only for undefined', () => {
    const fallback = vi.fn(() => 42);

    expect(valueOr(undefined, fallback)).toBe(42);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('should not call fallback callback if value is defined', () => {
    const fallback = vi.fn(() => 42);

    expect(valueOr(10, fallback)).toBe(10);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should not call fallback callback if value is null', () => {
    const fallback = vi.fn(() => 42);

    expect(valueOr(null, fallback)).toBe(null);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should support fallback callback with map', () => {
    const fallback = vi.fn(() => 100);
    const map = vi.fn((x: number) => x * 2);

    expect(valueOr(undefined, fallback, map)).toBe(100);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(map).not.toHaveBeenCalled();
  });

  it('should not call fallback callback if map is applied', () => {
    const fallback = vi.fn(() => 100);
    const map = vi.fn((x: number) => x * 2);

    expect(valueOr(5, fallback, map)).toBe(10);
    expect(map).toHaveBeenCalledWith(5);
    expect(fallback).not.toHaveBeenCalled();
  });
});
