import { ValidateIf } from 'class-validator';

export const SkipIfUndefined = (): PropertyDecorator =>
  ValidateIf((_obj, value) => value !== undefined);
