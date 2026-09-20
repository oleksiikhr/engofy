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

test.describe('post page', () => {
  const path = '/posts/the-cartographer-at-dawn-E2Eread1';

  test('has a unique description, article meta and Article/BreadcrumbList JSON-LD', async ({
    request,
  }) => {
    const html = await head(request, path);

    expect(html).toContain('<meta property="og:type" content="article"');
    expect(html).toMatch(
      /<meta property="article:published_time" content="\d{4}-\d{2}-\d{2}T[^"]+"/,
    );
    expect(html).toContain('<meta property="article:tag" content="B1"');
    expect(html).toContain(
      '<meta name="description" content="The old cartographer would perambulate the harbour at dawn',
    );
    expect(html).not.toContain(
      'content="Learn English through short authentic texts."',
    );

    const raw = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/,
    )?.[1];
    expect(raw).toBeDefined();
    const graph = JSON.parse(raw as string)['@graph'];
    const article = graph.find(
      (node: { '@type': string }) => node['@type'] === 'Article',
    );
    expect(article).toMatchObject({
      headline: 'The Cartographer at Dawn',
      inLanguage: 'en',
      educationalLevel: 'B1',
      isBasedOn: 'https://example.com/the-cartographer',
      publisher: { '@type': 'Organization', name: 'Engofy' },
    });
    expect(article.url).toMatch(
      /^https?:\/\/[^/]+\/posts\/the-cartographer-at-dawn-E2Eread1$/,
    );
    const crumbs = graph.find(
      (node: { '@type': string }) => node['@type'] === 'BreadcrumbList',
    );
    expect(
      crumbs.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['Home', 'Posts', 'The Cartographer at Dawn']);
  });
});

test.describe('post URL canonicalisation', () => {
  const canonical = '/posts/the-cartographer-at-dawn-E2Eread1';

  async function redirectOf(
    request: import('@playwright/test').APIRequestContext,
    path: string,
  ) {
    const response = await request.get(path, { maxRedirects: 0 });
    return {
      status: response.status(),
      location: response.headers().location,
    };
  }

  test('the canonical URL is served without a redirect', async ({
    request,
  }) => {
    expect((await redirectOf(request, canonical)).status).toBe(200);
  });

  test('a bare shortId redirects to the canonical URL', async ({ request }) => {
    expect(await redirectOf(request, '/posts/E2Eread1')).toEqual({
      status: 301,
      location: canonical,
    });
  });

  test('a wrong slug redirects and keeps the query string', async ({
    request,
  }) => {
    expect(
      await redirectOf(request, '/posts/wrong-slug-E2Eread1?from=home'),
    ).toEqual({ status: 301, location: `${canonical}?from=home` });
  });

  test('a wrong-case slug redirects', async ({ request }) => {
    expect(
      await redirectOf(request, '/posts/The-Cartographer-At-Dawn-E2Eread1'),
    ).toEqual({ status: 301, location: canonical });
  });

  test('an unknown shortId is a 404, not a redirect', async ({ request }) => {
    expect(
      (await redirectOf(request, '/posts/some-slug-Zzzzzzzz')).status,
    ).toBe(404);
  });
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

test.describe('sitemaps and robots.txt', () => {
  async function xml(
    request: import('@playwright/test').APIRequestContext,
    path: string,
  ): Promise<string> {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/xml');
    return res.text();
  }

  test('/sitemap.xml indexes the static and posts sitemaps', async ({
    request,
  }) => {
    const body = await xml(request, '/sitemap.xml');
    expect(body).toContain('<sitemapindex');
    expect(body).toMatch(/<loc>[^<]+\/sitemap\/static\.xml<\/loc>/);
    expect(body).toMatch(/<loc>[^<]+\/sitemap\/posts\.xml<\/loc>/);
  });

  test('static sitemap lists public pages and grammar, without dictionary', async ({
    request,
  }) => {
    const body = await xml(request, '/sitemap/static.xml');
    expect(body).toContain('<urlset');
    for (const path of ['/', '/posts', '/pricing', '/grammar']) {
      expect(body).toMatch(new RegExp(`<loc>https?://[^/<]+${path}</loc>`));
    }
    expect(body).toMatch(/<loc>[^<]+\/grammar\/e2e-past-perfect<\/loc>/);
    expect(body).not.toContain('/dictionary');
    expect(body).not.toContain('<lastmod>');
  });

  test('posts sitemap index points at 0-based page files', async ({
    request,
  }) => {
    const body = await xml(request, '/sitemap/posts.xml');
    expect(body).toContain('<sitemapindex');
    expect(body).toMatch(
      /<loc>[^<]+\/sitemap\/posts-0\.xml<\/loc><lastmod>\d{4}-\d{2}-\d{2}T[^<]+<\/lastmod>/,
    );
  });

  test('posts-0.xml lists published posts at their canonical URL with lastmod', async ({
    request,
  }) => {
    const body = await xml(request, '/sitemap/posts-0.xml');
    expect(body).toContain('<urlset');
    expect(body).toMatch(
      /<loc>[^<]+\/posts\/the-cartographer-at-dawn-E2Eread1<\/loc><lastmod>\d{4}-\d{2}-\d{2}T[^<]+<\/lastmod>/,
    );
  });

  test('a posts sitemap page past the last one is 404', async ({ request }) => {
    expect((await request.get('/sitemap/posts-99999.xml')).status()).toBe(404);
    expect((await request.get('/sitemap/posts-abc.xml')).status()).toBe(404);
  });

  test('robots.txt disallows service routes and points at the sitemap', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    for (const path of ['/api/', '/partials/', '/logout']) {
      expect(body).toContain(`Disallow: ${path}\n`);
    }
    // Crawlable so their `noindex` is read.
    expect(body).not.toMatch(/Disallow: \/(login|profile|practice)/);
    expect(body).toMatch(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m);
  });
});

function jsonLdGraph(html: string): { '@type': string }[] {
  const raw = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/,
  )?.[1];
  expect(raw).toBeDefined();
  return JSON.parse(raw as string)['@graph'];
}

test.describe('public pages', () => {
  test('the guest home page has its own title, description and WebSite/Organization JSON-LD', async ({
    request,
  }) => {
    const html = await head(request, '/');

    expect(html).toContain(
      '<title>Engofy — Learn English by Reading Short Texts (A1–C2)</title>',
    );
    expect(html).toContain(
      '<meta name="description" content="Read short authentic English texts sorted by level',
    );
    expect(html).not.toContain(
      'content="Learn English through short authentic texts."',
    );
    expect(jsonLdGraph(html).map((node) => node['@type'])).toEqual([
      'WebSite',
      'Organization',
    ]);
  });

  test('the guest home page links to posts and grammar', async ({
    request,
  }) => {
    const html = await head(request, '/');

    expect(html).toContain('aria-label="Latest posts"');
    expect(html).toContain('href="/posts/the-cartographer-at-dawn-E2Eread1"');
    expect(html).toContain('href="/posts"');
    expect(html).toContain('href="/grammar"');
    expect(html).toMatch(/href="\/grammar\/[^"]+"/);
  });

  test('/posts and /grammar have their own description', async ({
    request,
  }) => {
    for (const path of ['/posts', '/grammar']) {
      const html = await head(request, path);
      expect(html).not.toContain(
        'content="Learn English through short authentic texts."',
      );
    }
  });

  test('filters and cursors canonicalise to the base page', async ({
    request,
  }) => {
    expect(await head(request, '/posts?cefr=A1&cefr=B1&cursor=x')).toMatch(
      /<link rel="canonical" href="https?:\/\/[^"?]+\/posts"/,
    );
    expect(await head(request, '/grammar?cefr=A1&groupBy=time')).toMatch(
      /<link rel="canonical" href="https?:\/\/[^"?]+\/grammar"/,
    );
  });

  test('a /posts text search is noindex, level filters are not', async ({
    request,
  }) => {
    expect(await head(request, '/posts?term=harbour')).toContain(
      '<meta name="robots" content="noindex"',
    );
    expect(await head(request, '/posts?cefr=B1')).not.toContain(
      'name="robots"',
    );
  });

  test('grammar pages have a BreadcrumbList', async ({ request }) => {
    const list = jsonLdGraph(await head(request, '/grammar')).find(
      (node) => node['@type'] === 'BreadcrumbList',
    ) as unknown as { itemListElement: { name: string }[] };
    expect(list.itemListElement.map((item) => item.name)).toEqual([
      'Home',
      'Grammar',
    ]);

    const detail = jsonLdGraph(await head(request, '/grammar/e2e-past-perfect'))
      .filter((node) => node['@type'] === 'BreadcrumbList')
      .flatMap(
        (node) =>
          (node as unknown as { itemListElement: { name: string }[] })
            .itemListElement,
      );
    expect(detail.map((item) => item.name)).toEqual([
      'Home',
      'Grammar',
      expect.any(String),
    ]);
  });
});
