import { DomainError } from '../errors/domain.error.js';
import { isHttpUrl } from '../helpers/url.helper.js';

export class Url {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static of(value: string): Url {
    if (!isHttpUrl(value)) {
      throw new DomainError('Invalid URL');
    }

    return new Url(value);
  }

  toString(): string {
    return this.value;
  }
}
