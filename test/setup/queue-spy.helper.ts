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
        ([, jobName, data]) =>
          jobName === name && (!predicate || predicate(data as T)),
      );

      expect(match, `expected a "${name}" job to have been sent`).toBeTruthy();

      return match?.[2] as T;
    },
    assertNotSent(name: QueueName): void {
      expect(sendSpy.mock.calls.some(([, jobName]) => jobName === name)).toBe(
        false,
      );
    },
  };
}
