// Read-only readiness audit of every grammar page (plan grammar-page-readiness, slice 1).
// Needs the dev stack running. Usage: node scripts/grammar-audit.mjs [baseUrl] > audit.json
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4321';
const sql = `select json_agg(r) from (
  select c.slug, c.name,
    count(u.id)::int ups,
    count(u.id) filter (where coalesce(u.learner_explanation,'')<>'')::int with_expl,
    count(u.id) filter (where jsonb_array_length(coalesce(u.learner_examples,'[]'::jsonb))>0)::int with_examples,
    count(u.id) filter (where u.translations ? 'uk')::int with_uk,
    count(u.id) filter (where exists (select 1 from grammar_usage_point_exercises e where e.usage_point_id=u.id))::int with_ex,
    coalesce(length(c.cheat_sheet_content),0) cheat_len
  from grammar_constructions c left join grammar_usage_points u on u.construction_id=c.id
  group by c.id order by c.slug) r`;
const rows = JSON.parse(
  execFileSync(
    'docker',
    [
      'exec',
      '-e',
      'PGPASSWORD',
      'engofy-postgres-1',
      'psql',
      '-U',
      'engofy',
      '-d',
      'engofy',
      '-At',
      '-c',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  ),
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const out = [];
for (const r of rows) {
  const page = await ctx.newPage();
  const logs = [];
  const bad = [];
  page.on(
    'console',
    (m) =>
      ['error', 'warning'].includes(m.type()) &&
      logs.push(`${m.type()}: ${m.text().slice(0, 120)}`),
  );
  page.on('pageerror', (e) =>
    logs.push(`pageerror: ${e.message.slice(0, 120)}`),
  );
  page.on(
    'response',
    (x) =>
      x.status() >= 400 &&
      bad.push(`${x.status()} ${x.url().replace(base, '')}`),
  );
  let status = 0;
  try {
    const res = await page.goto(`${base}/grammar/${r.slug}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    status = res?.status() ?? 0;
  } catch (e) {
    logs.push(`nav: ${e.message.slice(0, 80)}`);
  }
  const dom = await page
    .evaluate(() => ({
      title: document.title,
      h1s: [...document.querySelectorAll('h1')].map((h) =>
        h.textContent.trim(),
      ),
      desc: !!document.querySelector('meta[name=description]')?.content,
      canonical: !!document.querySelector('link[rel=canonical]')?.href,
      jsonld: document.querySelectorAll('script[type="application/ld+json"]')
        .length,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
    }))
    .catch(() => ({}));
  out.push({ ...r, status, ...dom, logs, bad });
  await page.close();
}

const list = await (await fetch(`${base}/grammar`)).text();
const sitemapIdx = await (await fetch(`${base}/sitemap-index.xml`))
  .text()
  .catch(() => '');
const sm = await (await fetch(`${base}/sitemap/static.xml`))
  .text()
  .catch(() => '');
const testSlugs = rows
  .filter((r) => /^e2e-|^E2E/i.test(r.slug + r.name))
  .map((r) => r.slug);
const leaks = testSlugs.map((s) => ({
  slug: s,
  inList: list.includes(`/grammar/${s}`),
  inSitemap: (sitemapIdx + sm).includes(s),
}));
await browser.close();
console.log(JSON.stringify({ pages: out, leaks }, null, 1));
