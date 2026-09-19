import { fileURLToPath } from 'node:url';

// Playwright storageState for the seeded e2e user (see global-setup.ts).
// Specs that exercise an authed page do: test.use({ storageState: AUTHED_STATE }).
export const AUTHED_STATE = fileURLToPath(
  new URL('.auth/state.json', import.meta.url),
);

// Separate seeded user with a pending account-deletion request, for the
// /profile deletion specs (which mutate that user's state).
export const DELETION_STATE = fileURLToPath(
  new URL('.auth/deletion-state.json', import.meta.url),
);
