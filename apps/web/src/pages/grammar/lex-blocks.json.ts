import type { APIRoute } from 'astro';
import {
  extractPageLexBlocks,
  type LexBlockTargets,
} from '../../lib/lex-blocks';

// Every handcrafted grammar page's text blocks, keyed by construction slug —
// read by the backend's `grammar annotate-pages` to link the pages' words to
// the dictionary. Renders each page through this same server, so the blocks
// are exactly the ones the page later matches its spans against.
const handcraftedPages = import.meta.glob('../../grammar-pages/*.astro');
const SLUG_RE = /\/([^/]+)\.astro$/;

export const GET: APIRoute = async ({ url }) => {
  const slugs = Object.keys(handcraftedPages)
    .map((path) => path.match(SLUG_RE)?.[1])
    .filter((slug): slug is string => slug !== undefined);

  const pages: Record<string, LexBlockTargets[]> = {};
  for (const slug of slugs) {
    // One page at a time keeps the self-requests from piling onto the API.
    const response = await fetch(new URL(`/grammar/${slug}`, url));
    // A page that doesn't render would silently lose its spans — fail the
    // whole list instead, so the CLI stops.
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `/grammar/${slug}: ${response.status}` }),
        { status: 502, headers: { 'content-type': 'application/json' } },
      );
    }
    pages[slug] = extractPageLexBlocks(await response.text());
  }
  return new Response(JSON.stringify({ pages }), {
    headers: { 'content-type': 'application/json' },
  });
};
