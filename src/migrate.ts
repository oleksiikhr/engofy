// One-shot migration runner. Applies every pending migration, then exits.
//
// Runs from the production runtime image as `node migrate` (WORKDIR
// /app/dist) — the deploy step BEFORE a rollout (see docs/deploy.md). The
// runtime image only has --prod deps, so `pnpm migration:up` (mikro-orm CLI +
// @swc-node/register, both devDeps) is not available there; this uses the
// MikroORM programmatic Migrator instead, off the exact same
// `mikro-orm.setup.ts` config the app and `pnpm migration:up` use.
//
// CI still runs `pnpm migration:up && pnpm migration:check` against a clean DB
// (D17) — that stays the gate for entities-vs-migrations drift.

import { MikroORM } from '@mikro-orm/postgresql';
import config from './core/database/mikro-orm.setup.js';

const orm = await MikroORM.init(config);

try {
  const applied = await orm.migrator.up();

  if (applied.length === 0) {
    console.log('migrate: no pending migrations');
  } else {
    console.log(
      `migrate: applied ${applied.length} — ${applied.map((m) => m.name).join(', ')}`,
    );
  }
} catch (err) {
  console.error('migrate: failed', err);
  process.exitCode = 1;
} finally {
  await orm.close(true);
}
