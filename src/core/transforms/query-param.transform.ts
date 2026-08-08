import { Transform } from 'class-transformer';

// TODO Rename file?
// TODO Add tests
export const CoerceToArray = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (!value) {
      return undefined;
    }

    return Array.isArray(value) ? value : [value];
  });

export const CoerceToBoolean = (): PropertyDecorator =>
  Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  );
