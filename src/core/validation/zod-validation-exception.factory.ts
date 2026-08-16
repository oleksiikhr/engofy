import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
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

export function zodValidationExceptionFactory(
  error: unknown,
): BadRequestException {
  const issue = error instanceof ZodError ? error.issues[0] : undefined;

  if (!issue) {
    return new BadRequestException(
      makeResponse({ message: 'Validation failed', field: null }),
    );
  }

  return new BadRequestException(
    makeResponse({
      message: issue.message,
      field: issue.path.length > 0 ? issue.path.join('.') : null,
    }),
  );
}
