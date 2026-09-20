import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Head metadata must be in the server response itself (crawlers do not run JS),
// so these read the raw HTML through `request`, not the hydrated DOM.
async function head(
  request: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<string> {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  return response.text();
}

test('a public page has canonical, Open Graph and Twitter tags in the HTML', async ({
  request,
}) => {
  const html = await head(request, '/pricing?utm_source=x');

  expect(html).toMatch(
    /<link rel="canonical" href="https?:\/\/[^"?]+\/pricing"/,
  );
  expect(html).toContain('<meta property="og:site_name" content="Engofy"');
  expect(html).toContain('<meta property="og:type" content="website"');
  expect(html).toContain(
    '<meta property="og:title" content="Pricing — Engofy"',
  );
  expect(html).toMatch(
    /<meta property="og:url" content="https?:\/\/[^"?]+\/pricing"/,
  );
  expect(html).toContain('<meta name="twitter:card" content="summary"');
  expect(html).not.toContain('og:image');
  expect(html).not.toContain('name="robots"');
});

test('/pricing stays indexable', async ({ request }) => {
  expect(await head(request, '/pricing')).not.toContain('name="robots"');
});

test('/login is noindex', async ({ request }) => {
  expect(await head(request, '/login')).toContain(
    '<meta name="robots" content="noindex"',
  );
});

test.describe('signed-in pages', () => {
  test.use({ storageState: AUTHED_STATE });

  for (const path of [
    '/profile',
    '/profile/progress',
    '/profile/subscription',
    '/practice',
    '/dictionary',
  ]) {
    test(`${path} is noindex`, async ({ request }) => {
      expect(await head(request, path)).toContain(
        '<meta name="robots" content="noindex"',
      );
    });
  }
});

test('/posts is noindex only when the query is invalid', async ({
  request,
}) => {
  expect(await head(request, '/posts')).not.toContain('name="robots"');
  expect(await head(request, '/posts?cursor=garbage')).toContain(
    '<meta name="robots" content="noindex"',
  );
});

test('service routes send X-Robots-Tag: noindex', async ({ request }) => {
  const partial = await request.get('/partials/posts');
  expect(partial.headers()['x-robots-tag']).toBe('noindex');

  // Astro rejects a cross-site POST before the route runs; send our own origin.
  const logout = await request.post('/logout', {
    headers: { origin: new URL(partial.url()).origin },
    maxRedirects: 0,
  });
  expect(logout.headers()['x-robots-tag']).toBe('noindex');

  const page = await request.get('/pricing');
  expect(page.headers()['x-robots-tag']).toBeUndefined();
});
