import type { Page } from '@playwright/test';

// Blocks every script request so a "does not shift when scripts run" check
// can compare the pre-hydration layout against the post-hydration one. Filters
// by resource type, not a URL glob (e.g. `**/_astro/**`): dev serves scripts
// from `/src/**?astro&type=script...` and `/@vite/client`, which such a glob
// misses entirely (nothing gets blocked, so the comparison is vacuous), while
// a production build's bundled CSS lands under the same `_astro/` directory
// as its JS, so the glob also blocks stylesheets and the page renders
// unstyled — a false failure unrelated to any real layout shift.
export async function blockScripts(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    if (route.request().resourceType() === 'script') {
      return route.abort();
    }
    return route.continue();
  });
}
