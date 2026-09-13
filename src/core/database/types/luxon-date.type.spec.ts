import { DateTime } from 'luxon';
import { LuxonDateType } from './luxon-date.type.js';

describe('LuxonDateType', () => {
  const type = new LuxonDateType();

  it('should convert DateTime to a database date string in UTC', () => {
    const input = DateTime.fromISO('2026-02-13T23:30:00', {
      zone: 'Europe/Kyiv',
    });

    expect(type.convertToDatabaseValue(input)).toBe('2026-02-13');
  });

  it('should convert SQL date string to a UTC start-of-day DateTime', () => {
    const jsValue = type.convertToJSValue('2026-02-13');

    expect(jsValue?.toISO()).toBe('2026-02-13T00:00:00.000Z');
    expect(jsValue?.zoneName).toBe('UTC');
  });

  it('should convert JS Date to a UTC start-of-day DateTime', () => {
    const jsValue = type.convertToJSValue(new Date('2026-02-13T18:00:00Z'));

    expect(jsValue?.toISO()).toBe('2026-02-13T00:00:00.000Z');
  });

  it('should return undefined if value is undefined', () => {
    expect(type.convertToDatabaseValue(undefined)).toBeUndefined();
    expect(type.convertToJSValue(undefined)).toBeUndefined();
  });

  it('should throw on invalid SQL string', () => {
    expect(() => type.convertToJSValue('invalid-date')).toThrow();
  });

  it('should throw on invalid DateTime input', () => {
    expect(() =>
      type.convertToDatabaseValue(DateTime.invalid('test invalid')),
    ).toThrow();
  });

  it('should return correct column type for PostgreSQL', () => {
    expect(type.getColumnType()).toBe('date');
  });
});
