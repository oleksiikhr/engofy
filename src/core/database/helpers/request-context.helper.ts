import type { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '@mikro-orm/core';
import { isTestEnvironment } from '../../enums/environment.enum.js';

export function shouldSkipRequestContext(): boolean {
  return isTestEnvironment();
}

export function withRequestContext<T>(
  em: EntityManager,
  fn: () => Promise<T>,
): Promise<T> {
  return shouldSkipRequestContext() ? fn() : RequestContext.create(em, fn);
}
