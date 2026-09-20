export interface SitemapUrl {
  loc: string;
  // ISO-8601; omitted when the page has no real change time.
  lastmod?: string;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const XMLNS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

export const SITEMAP_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=3600',
};

export function sitemapResponse(body: string): Response {
  return new Response(body, { headers: SITEMAP_HEADERS });
}

// `<urlset>` of page URLs.
export function buildUrlset(entries: SitemapUrl[]): string {
  return `${XML_HEADER}<urlset xmlns="${XMLNS}">\n${entries.map((entry) => `  <url>${tags(entry)}</url>`).join('\n')}\n</urlset>\n`;
}

// `<sitemapindex>` of child sitemap URLs.
export function buildSitemapIndex(entries: SitemapUrl[]): string {
  return `${XML_HEADER}<sitemapindex xmlns="${XMLNS}">\n${entries.map((entry) => `  <sitemap>${tags(entry)}</sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

function tags({ loc, lastmod }: SitemapUrl): string {
  const lastmodTag = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  return `<loc>${escapeXml(loc)}</loc>${lastmodTag}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
