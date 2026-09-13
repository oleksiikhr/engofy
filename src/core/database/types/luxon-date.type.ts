import { Type } from '@mikro-orm/core';
import { DateTime } from 'luxon';

// Calendar day only (Postgres `date`) — no time-of-day, no offset. Used for
// `daily_plans.plan_date`: the UTC calendar day, same convention as
// `domain/daily-streak.ts`'s streak bucketing.
export class LuxonDateType extends Type<
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

    const isoDate = value.toUTC().toISODate();
    if (!isoDate) {
      throw new Error('Invalid date', { cause: { value } });
    }

    return isoDate;
  }

  convertToJSValue(value: string | Date | undefined): DateTime | undefined {
    if (!value) {
      return undefined;
    }

    let dateTime: DateTime;

    if (value instanceof Date) {
      dateTime = DateTime.fromJSDate(value, { zone: 'utc' });
    } else {
      dateTime = DateTime.fromISO(value, { zone: 'utc' });
    }

    if (!dateTime.isValid) {
      throw new Error('Invalid date', { cause: { value } });
    }

    return dateTime.startOf('day');
  }

  getColumnType(): string {
    return 'date';
  }

  compareAsType(): string {
    return 'date';
  }
}
