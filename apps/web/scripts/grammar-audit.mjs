// Read-only readiness audit of every grammar page (plan grammar-page-readiness, slice 1).
// Needs the dev stack running. Usage: node scripts/grammar-audit.mjs [baseUrl] > audit.json
// With --check, prints the failed checklist items per real page (B1-B6, D1, D3; only EGP-backed usage points count)
// instead of the JSON and exits 1 if any failed. Fixtures (`e2e-*`) are not in the EGP and
// are skipped.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const check = args.includes('--check');
const base = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:4321';
const sql = `select json_agg(r) from (
  select c.slug, c.name,
    count(u.id)::int ups,
    count(u.id) filter (where coalesce(u.learner_explanation,'')<>'')::int with_expl,
    count(u.id) filter (where jsonb_array_length(coalesce(u.learner_examples,'[]'::jsonb))>0)::int with_examples,
    count(u.id) filter (where u.translations ? 'uk')::int with_uk,
    count(u.id) filter (where exists (select 1 from grammar_usage_point_exercises e where e.usage_point_id=u.id))::int with_ex,
    coalesce(length(c.cheat_sheet_content),0) cheat_len
  from grammar_constructions c left join grammar_usage_points u on u.construction_id=c.id and u.egp_index is not null
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

if (!check) {
  console.log(JSON.stringify({ pages: out, leaks }, null, 1));
  process.exit(0);
}

// Mirrors `grammarConstructionSlug` and `classifyEgpRecord` (src/modules/post/domain/egp.ts).
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const egp = JSON.parse(
  readFileSync(new URL('../../../assets/egp.json', import.meta.url), 'utf8'),
);
const hasForm = new Set(
  egp
    .filter((r) => {
      const g = r.guideword.trim().toUpperCase();
      return !(g.startsWith('USE') || g.startsWith('FORM/USE'));
    })
    .map((r) => `${slugify(r.category)}-${slugify(r.subcategory)}`),
);
const real = new Set(
  egp.map((r) => `${slugify(r.category)}-${slugify(r.subcategory)}`),
);
// `focus-focus`: the subcategory repeats the category, so one word is the real name.
const isCategoryName = (slug) => {
  const parts = slug.split('-');
  const half = parts.length / 2;
  return (
    Number.isInteger(half) &&
    parts.slice(0, half).join('-') === parts.slice(half).join('-')
  );
};
const failures = [];
const seenH1 = new Set();
for (const p of out.filter((x) => real.has(x.slug))) {
  const f = [];
  if (p.status !== 200) f.push(`B1 status ${p.status}`);
  if (p.logs?.length) f.push(`B1 console ${p.logs.join('; ')}`);
  if (p.bad?.length) f.push(`B1 network ${p.bad.join('; ')}`);
  if (!p.ups) f.push('B2 no usage point');
  for (const k of ['with_expl', 'with_examples', 'with_uk']) {
    if (p[k] !== p.ups) f.push(`B3 ${k} ${p[k]}/${p.ups}`);
  }
  const h1 = p.h1s?.[0] ?? '';
  const words = h1.split(/\s+/).filter(Boolean);
  if (p.h1s?.length !== 1) f.push(`B5 ${p.h1s?.length} H1`);
  if (!p.title || !p.desc || !p.canonical || !p.jsonld) f.push('B5 meta');
  if (seenH1.has(h1) || (words.length < 2 && !isCategoryName(p.slug)))
    f.push(`B4 name "${h1}"`);
  seenH1.add(h1);
  if (p.hscroll) f.push('B6 horizontal scroll');
  if (p.with_ex !== p.ups) f.push(`D1 exercises ${p.with_ex}/${p.ups}`);
  if (hasForm.has(p.slug) && !p.cheat_len) f.push('D3 no cheat sheet');
  if (f.length) failures.push(`${p.slug}: ${f.join(' | ')}`);
}
// B9 stays a warning: fixtures in a dev DB (e2e seed before DB isolation) are not a product defect.
for (const l of leaks) {
  if (l.inList || l.inSitemap) console.warn(`B9 warning: ${l.slug} listed`);
}
console.log(
  failures.length
    ? failures.join('\n')
    : `ok: ${real.size} pages pass the checklist`,
);
process.exit(failures.length ? 1 : 0);
