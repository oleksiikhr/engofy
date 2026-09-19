import { defineConfig, devices } from '@playwright/test';

// No `webServer`: the pages are SSR and call the Nest API, which needs a
// migrated + seeded Postgres/Redis it cannot stand up itself. Run the stack
// first — `docker compose up -d postgres redis`, the Nest web server, and
// `pnpm --filter @engofy/web dev` — then `pnpm --filter @engofy/web test:e2e`.
// Point WEB_BASE_URL at an already-running instance to override the default.
export default defineConfig({
  testDir: './e2e',
  // Seeds the dev DB with deterministic fixtures and writes the authed
  // storageState (see e2e/global-setup.ts).
  globalSetup: './e2e/global-setup.ts',
  // The specs share one seeded user and mutate it (cards, dispositions), so
  // they run one at a time; `pristine` goes first for the two that assert
  // exact counts and must see the untouched seed.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'pristine',
      testMatch: /(practice|profile-progress)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /(practice|profile-progress)\.spec\.ts/,
      dependencies: ['pristine'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
