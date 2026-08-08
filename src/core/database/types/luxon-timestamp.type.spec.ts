import { DateTime } from 'luxon';
import { LuxonTimestampType } from './luxon-timestamp.type.js';

describe('LuxonTimestampType', () => {
  const type = new LuxonTimestampType();

  it('should convert DateTime to database string in UTC', () => {
    const input = DateTime.fromISO('2026-02-13T14:00:00', {
      zone: 'Europe/Kyiv',
    });

    const dbValue = type.convertToDatabaseValue(input);

    expect(dbValue).toBe('2026-02-13 12:00:00.000');
  });

  it('should convert SQL string to UTC DateTime', () => {
    const input = '2026-02-13 12:00:00.000';

    const jsValue = type.convertToJSValue(input);

    expect(jsValue?.toISO()).toBe('2026-02-13T12:00:00.000Z');
    expect(jsValue?.zoneName).toBe('UTC');
  });

  it('should convert JS Date to UTC DateTime', () => {
    const input = new Date('2026-02-13T12:00:00Z');

    const jsValue = type.convertToJSValue(input);

    expect(jsValue?.toISO()).toBe('2026-02-13T12:00:00.000Z');
  });

  it('should return undefined if value is undefined', () => {
    expect(type.convertToDatabaseValue(undefined)).toBeUndefined();
    expect(type.convertToJSValue(undefined)).toBeUndefined();
  });

  it('should throw on invalid SQL string', () => {
    expect(() => type.convertToJSValue('invalid-date')).toThrow();
  });

  it('should return correct column type for PostgreSQL', () => {
    expect(type.getColumnType()).toBe('timestamp with time zone');
  });

  it('should convert JS Date to database string in UTC', () => {
    const input = new Date('2026-02-13T14:00:00Z');

    const dbValue = type.convertToDatabaseValue(input);

    expect(dbValue).toBe('2026-02-13 14:00:00.000');
  });

  it('should normalize JS Date with non-UTC offset to UTC when writing to database', () => {
    // 14:00 +02:00 === 12:00 UTC
    const input = new Date('2026-02-13T14:00:00+02:00');

    const dbValue = type.convertToDatabaseValue(input);

    expect(dbValue).toBe('2026-02-13 12:00:00.000');
  });

  it('should throw on invalid DateTime input to convertToDatabaseValue', () => {
    const invalidDateTime = DateTime.invalid('test invalid');
    expect(() => type.convertToDatabaseValue(invalidDateTime)).toThrow();
  });
});
