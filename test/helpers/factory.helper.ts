import { faker } from '@faker-js/faker';

export function maybe<T>(valueFactory: () => T): T | null {
  return faker.datatype.boolean() ? valueFactory() : null;
}
