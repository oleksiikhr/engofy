import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { ErrorFilter } from './error.filter.js';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

function buildHost(response: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

describe('ErrorFilter', () => {
  it('replies through the http adapter, never touching the response directly', () => {
    const reply = vi.fn();
    const httpAdapterHost = {
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost;
    const filter = new ErrorFilter(httpAdapterHost);

    // Nest can hand back the raw Node response (no `.status()`/`.send()`) on
    // some failure paths — this reproduces that shape.
    const response = {};

    expect(() =>
      filter.catch(new Error('Boom'), buildHost(response)),
    ).not.toThrow();

    expect(reply).toHaveBeenCalledWith(
      response,
      { message: 'Internal server error' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('reports the exception to Sentry', () => {
    const httpAdapterHost = {
      httpAdapter: { reply: vi.fn() },
    } as unknown as HttpAdapterHost;
    const filter = new ErrorFilter(httpAdapterHost);
    const error = new Error('Boom');

    filter.catch(error, buildHost({}));

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
