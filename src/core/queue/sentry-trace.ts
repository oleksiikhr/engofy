import * as Sentry from '@sentry/nestjs';

export interface SentryTraceFields {
  _sentryTrace?: string;
  _sentryBaggage?: string;
}

export function withSentryTrace<T>(data: T): T & SentryTraceFields {
  const traceData = Sentry.getTraceData();
  return {
    ...data,
    _sentryTrace: traceData['sentry-trace'],
    _sentryBaggage: traceData.baggage,
  };
}
