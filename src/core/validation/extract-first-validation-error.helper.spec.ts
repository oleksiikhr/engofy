import { ValidationError } from 'class-validator';
import { extractFirstValidationError } from './extract-first-validation-error.helper.js';

describe('extractFirstValidationError', () => {
  it('returns top-level constraint error', () => {
    const error: ValidationError = {
      property: 'email',
      constraints: {
        isEmail: 'email must be an email',
      },
      children: [],
    };

    const result = extractFirstValidationError(error);

    expect(result).toEqual({
      field: 'email',
      message: 'email must be an email',
    });
  });

  it('returns nested constraint error', () => {
    const error: ValidationError = {
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
    };

    const result = extractFirstValidationError(error);

    expect(result).toEqual({
      field: 'profile.email',
      message: 'email must be an email',
    });
  });

  it('returns deeply nested constraint error', () => {
    const error: ValidationError = {
      property: 'user',
      constraints: undefined,
      children: [
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
      ],
    };

    const result = extractFirstValidationError(error);

    expect(result).toEqual({
      field: 'user.profile.email',
      message: 'email must be an email',
    });
  });

  it('returns null if no constraints and no children', () => {
    const error: ValidationError = {
      property: 'empty',
      constraints: undefined,
      children: [],
    };

    const result = extractFirstValidationError(error);

    expect(result).toBeNull();
  });
});
