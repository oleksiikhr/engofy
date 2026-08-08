import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory.js';

describe('validationExceptionFactory', () => {
  it('returns default error when no errors provided', () => {
    const exception = validationExceptionFactory([]);

    expect(exception).toBeInstanceOf(BadRequestException);

    const response = exception.getResponse();

    expect(response).toEqual({
      message: 'Validation failed',
      field: null,
      type: 'validation',
    });
  });

  it('returns top-level validation error', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: {
          isEmail: 'email must be an email',
        },
        children: [],
      },
    ];

    const exception = validationExceptionFactory(errors);
    const response = exception.getResponse();

    expect(response).toEqual({
      field: 'email',
      message: 'email must be an email',
      type: 'validation',
    });
  });

  it('returns nested validation error', () => {
    const errors: ValidationError[] = [
      {
        property: 'profile',
        constraints: undefined,
        children: [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be an email',
            },
            children: [],
          },
        ],
      },
    ];

    const exception = validationExceptionFactory(errors);
    const response = exception.getResponse();

    expect(response).toEqual({
      field: 'profile.email',
      message: 'email must be an email',
      type: 'validation',
    });
  });
});
