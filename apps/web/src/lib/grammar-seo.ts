import type { GrammarConstructionDetail, GrammarReference } from './types';

// Search snippets truncate around 155-160 characters.
const DESCRIPTION_MAX = 158;

// Generic per-construction meta description, built from the construction's own
// data. Handcrafted pages pass their own to `GrammarShell` instead.
export function grammarMetaDescription(con: GrammarConstructionDetail): string {
  const level = con.cefrLevel ? ` (${con.cefrLevel})` : '';
  const head = `${con.name}${level} — ${con.categoryName} in English grammar.`;
  const canDo = con.usagePoints[0]?.canDoStatement;
  return truncate(canDo ? `${head} ${canDo}` : head, DESCRIPTION_MAX);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// Every construction slug across all groups, de-duplicated, in list order.
export function grammarSlugs(reference: GrammarReference): string[] {
  const slugs = new Set<string>();
  for (const group of reference.groups) {
    for (const con of group.constructions) {
      slugs.add(con.slug);
    }
  }
  return [...slugs];
}

// `sitemap.xml` for the grammar reference: the index plus one entry per
// construction. `origin` has no trailing slash.
export function buildGrammarSitemap(origin: string, slugs: string[]): string {
  const paths = [
    '/grammar',
    ...slugs.map((slug) => `/grammar/${encodeURIComponent(slug)}`),
  ];
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
