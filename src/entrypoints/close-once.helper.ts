import type { INestApplicationContext } from '@nestjs/common';

/**
 * Guards `app.close()` for the bootstrap entrypoints (worker, cron): the
 * SIGTERM/SIGINT handler and the outer `catch` block can both reach it — when
 * the signal handler's close rejects, its promise rejection propagates out of
 * the awaited shutdown promise straight into the `catch`, which would otherwise
 * call `app.close()` a second time and race the first teardown. `closeOnce`
 * memoises the first call's promise and hands it back to every later caller.
 */
export function closeOnce(
  app: INestApplicationContext | undefined,
): () => Promise<void> {
  let closing: Promise<void> | undefined;

  return () => {
    closing ??= app ? app.close() : Promise.resolve();
    return closing;
  };
}
