import type { APIRoute } from 'astro';
import { apiGet } from '../lib/api';
import { buildGrammarSitemap, grammarSlugs } from '../lib/grammar-seo';
import { publicOrigin } from '../lib/site';
import type { GrammarReference } from '../lib/types';

export const GET: APIRoute = async ({ url }) => {
  const origin = publicOrigin(url);
  const reference = await apiGet<GrammarReference>('/content/grammar');
  return new Response(buildGrammarSitemap(origin, grammarSlugs(reference)), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
