import * as Sentry from '@sentry/nestjs';
import { withSentryTrace } from './sentry-trace.js';

vi.mock('@sentry/nestjs', () => ({ getTraceData: vi.fn() }));

const mockGetTraceData = vi.mocked(Sentry.getTraceData);

describe('withSentryTrace()', () => {
  it('merges sentry trace data into the payload', () => {
    mockGetTraceData.mockReturnValue({
      'sentry-trace': 'abc123',
      baggage: 'sentry-trace=abc123',
    });

    expect(withSentryTrace({ foo: 'bar' })).toEqual({
      foo: 'bar',
      _sentryTrace: 'abc123',
      _sentryBaggage: 'sentry-trace=abc123',
    });
  });

  it('sets fields to undefined when there is no active trace', () => {
    mockGetTraceData.mockReturnValue({});

    expect(withSentryTrace({ foo: 'bar' })).toEqual({
      foo: 'bar',
      _sentryTrace: undefined,
      _sentryBaggage: undefined,
    });
  });
});
