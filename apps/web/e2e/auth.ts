import { fileURLToPath } from 'node:url';

// Playwright storageState for the seeded e2e user (see global-setup.ts).
// Specs that exercise an authed page do: test.use({ storageState: AUTHED_STATE }).
export const AUTHED_STATE = fileURLToPath(
  new URL('.auth/state.json', import.meta.url),
);
