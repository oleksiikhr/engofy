import { Type } from '@mikro-orm/core';
import { DateTime } from 'luxon';

export class LuxonTimestampType extends Type<
  DateTime | undefined,
  string | undefined
> {
  convertToDatabaseValue(
    value: DateTime | Date | undefined,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      value = DateTime.fromJSDate(value, { zone: 'utc' });
    }

    const dateTime = value.toUTC().toSQL({ includeOffset: false });
    if (!dateTime) {
      throw new Error('Invalid date time', { cause: { value } });
    }

    return dateTime;
  }

  convertToJSValue(value: string | Date | undefined): DateTime | undefined {
    if (!value) {
      return undefined;
    }

    let dateTime: DateTime;

    if (value instanceof Date) {
      dateTime = DateTime.fromJSDate(value, { zone: 'utc' });
    } else {
      dateTime = DateTime.fromSQL(value, { zone: 'utc' });
    }

    if (!dateTime.isValid) {
      throw new Error('Invalid date time', { cause: { value } });
    }

    return dateTime;
  }

  getColumnType(): string {
    return 'timestamp with time zone'; // Postgres
  }
}
