import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { zodValidationExceptionFactory } from './zod-validation-exception.factory.js';

describe('zodValidationExceptionFactory', () => {
  it('returns top-level validation error', () => {
    const result = z.object({ email: z.email() }).safeParse({
      email: 'not-an-email',
    });

    if (result.success) {
      throw new Error('expected validation to fail');
    }

    const exception = zodValidationExceptionFactory(result.error);

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toEqual({
      field: 'email',
      message: expect.any(String),
      type: 'validation',
    });
  });

  it('returns nested validation error', () => {
    const result = z
      .object({ profile: z.object({ email: z.email() }) })
      .safeParse({ profile: { email: 'not-an-email' } });

    if (result.success) {
      throw new Error('expected validation to fail');
    }

    const exception = zodValidationExceptionFactory(result.error);

    expect(exception.getResponse()).toEqual({
      field: 'profile.email',
      message: expect.any(String),
      type: 'validation',
    });
  });
});
