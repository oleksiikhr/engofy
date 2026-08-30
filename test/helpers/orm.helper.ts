import type { MikroORM } from '@mikro-orm/core';

export function injectOrm<T>(instance: T, partial: object = {}): T {
  (instance as unknown as { orm: MikroORM }).orm =
    partial as unknown as MikroORM;

  return instance;
}
