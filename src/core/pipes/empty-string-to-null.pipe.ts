import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_EMPTY_TO_NULL_KEY } from '../decorators/no-empty-to-null.decorator.js';

@Injectable()
export class EmptyStringToNullPipe implements PipeTransform {
  constructor(private readonly reflector: Reflector) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const exclude: string[] = metadata.metatype
      ? this.reflector.get<string[]>(NO_EMPTY_TO_NULL_KEY, metadata.metatype) ||
        []
      : [];

    return this.normalize(value, '', exclude);
  }

  private normalize(value: unknown, path: string, exclude: string[]): unknown {
    if (exclude.includes(path)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v, i) => this.normalize(v, `${path}[${i}]`, exclude));
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          this.normalize(v, path ? `${path}.${k}` : k, exclude),
        ]),
      );
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }

    return value;
  }
}
