import { SetMetadata } from '@nestjs/common';

export const NO_EMPTY_TO_NULL_KEY = 'noEmptyToNull';

export const NoEmptyToNull = (...fields: string[]) =>
  SetMetadata(NO_EMPTY_TO_NULL_KEY, fields);
