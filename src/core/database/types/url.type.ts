import { Type } from '@mikro-orm/core';
import { Url } from '../../value-objects/url.vo.js';

// TODO Add tests
export class UrlType extends Type<Url | null, string | null> {
  convertToDatabaseValue(value: Url | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.value;
  }

  convertToJSValue(value: string | null | Url): Url | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Url) {
      return value;
    }

    return Url.of(value);
  }

  getColumnType(): string {
    return 'text';
  }
}
