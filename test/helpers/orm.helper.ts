import type { MikroORM } from '@mikro-orm/core';
import { ChangeSetType, type FlushEventArgs } from '@mikro-orm/core';

export function makeChangeSet<T extends object>(
  entity: T,
  type: ChangeSetType,
  payload: Record<string, unknown> | null = null,
  originalEntity?: Partial<T>,
) {
  return { entity, type, payload, originalEntity } as never;
}

export function makeFlushArgs(
  changeSets: ReturnType<typeof makeChangeSet>[],
): FlushEventArgs {
  return {
    uow: { getChangeSets: () => changeSets },
  } as unknown as FlushEventArgs;
}

export function injectOrm<T>(instance: T, partial: object = {}): T {
  (instance as unknown as { orm: MikroORM }).orm =
    partial as unknown as MikroORM;

  return instance;
}
