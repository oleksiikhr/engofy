import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { extractFirstValidationError } from './extract-first-validation-error.helper.js';
import { ValidationErrorResponseDto } from './validation-error-response.dto.js';

function makeResponse(data: {
  message: string;
  field: string | null;
}): ValidationErrorResponseDto {
  return {
    message: data.message,
    field: data.field,
    type: 'validation',
  };
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  for (const error of errors) {
    const extracted = extractFirstValidationError(error);

    if (extracted) {
      return new BadRequestException(makeResponse(extracted));
    }
  }

  return new BadRequestException(
    makeResponse({ message: 'Validation failed', field: null }),
  );
}
