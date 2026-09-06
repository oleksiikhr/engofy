import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright global setup for the Slice 8b page suite.
//
// 1. Seeds the local *dev* database with deterministic fixtures by shelling
//    out to the Nest repo's seed script (same swc-node loader the CLI uses).
// 2. Writes a Playwright storageState carrying the fixed session cookie for
//    the seeded e2e user, so authed-page specs can `test.use({ storageState })`.
//
// The token here MUST match E2E_SESSION_TOKEN in test/e2e/seed-web-e2e.ts.

const here = dirname(fileURLToPath(import.meta.url)); // apps/web/e2e
const repoRoot = resolve(here, '../../..');
const STATE_PATH = resolve(here, '.auth/state.json');
const SESSION_TOKEN = 'e2e-fixed-session-token-000000000000';
const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? '__Host-session';

export default function globalSetup(): void {
  execFileSync(
    'node',
    ['--import', '@swc-node/register/esm-register', 'test/e2e/seed-web-e2e.ts'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' },
    },
  );

  const base = new URL(process.env.WEB_BASE_URL ?? 'http://localhost:4321');
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        cookies: [
          {
            name: cookieName,
            value: SESSION_TOKEN,
            domain: base.hostname,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  );
}
