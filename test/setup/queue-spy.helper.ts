import type { MockInstance } from 'vitest';
import { OutboxSenderService } from '../../src/core/queue/outbox-sender.service.js';
import type { QueueName } from '../../src/core/queue/queue-names.enum.js';
import type { IntegrationSuite } from './int-suite.helper.js';

export interface QueueSpy {
  assertSent<T extends object>(
    name: QueueName,
    predicate?: (data: T) => boolean,
  ): T;
  assertNotSent(name: QueueName): void;
}

// A single recorded `OutboxSenderService.send(em, name, data, options?)` call.
// The spy reads the queue name / payload out of it by that shape; kept behind
// these two accessors so a signature change only has to be reflected here.
type SendCall = Parameters<OutboxSenderService['send']>;

const queueName = (call: SendCall): string => call[1];
const queuePayload = <T>(call: SendCall): T => call[2] as T;

export function useQueueSpy(suite: IntegrationSuite): QueueSpy {
  let sendSpy: MockInstance<OutboxSenderService['send']>;

  beforeAll(() => {
    sendSpy = vi.spyOn(suite.moduleRef.get(OutboxSenderService), 'send');
  });

  return {
    assertSent<T extends object>(
      name: QueueName,
      predicate?: (data: T) => boolean,
    ): T {
      const match = sendSpy.mock.calls.find(
        (call) =>
          queueName(call) === name &&
          (!predicate || predicate(queuePayload<T>(call))),
      );

      expect(match, `expected a "${name}" job to have been sent`).toBeTruthy();

      return queuePayload<T>(match as SendCall);
    },
    assertNotSent(name: QueueName): void {
      expect(sendSpy.mock.calls.some((call) => queueName(call) === name)).toBe(
        false,
      );
    },
  };
}
