import { postUrl } from './post-url';
import { breadcrumbList } from './seo';
import type { Block, PostDetail } from './types';

const DESCRIPTION_MAX_CHARS = 155;

// Plain text of the leading body blocks, cut on a word boundary. Headings are
// skipped: they repeat the title rather than describe the text.
export function postDescription(
  doc: PostDetail['doc'],
  fallback: string,
): string {
  let text = '';
  for (const block of doc.children) {
    if (text.length >= DESCRIPTION_MAX_CHARS) {
      break;
    }
    const blockText = blockPlainText(block);
    if (blockText) {
      text = text ? `${text} ${blockText}` : blockText;
    }
  }
  return text ? truncate(text, DESCRIPTION_MAX_CHARS) : fallback;
}

function blockPlainText(block: Block): string {
  const inline =
    block.type === 'list'
      ? block.items.flatMap((item) => item.children)
      : block.level
        ? []
        : block.children;
  return inline
    .map((node) => node.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${cut.trimEnd()}…`;
}

// One JSON-LD document: the Article plus the Home → Posts → post trail.
export function postJsonLd(
  post: Pick<
    PostDetail,
    'shortId' | 'slug' | 'title' | 'cefrLevel' | 'publishedAt' | 'sourceLink'
  >,
  origin: string,
  description: string,
): Record<string, unknown> {
  const url = `${origin}${postUrl(post)}`;
  const headline = post.title ?? 'Untitled';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline,
        description,
        datePublished: post.publishedAt,
        inLanguage: 'en',
        ...(post.cefrLevel && { educationalLevel: post.cefrLevel }),
        ...(post.sourceLink && { isBasedOn: post.sourceLink }),
        publisher: {
          '@type': 'Organization',
          name: 'Engofy',
          url: origin,
        },
      },
      breadcrumbList(origin, [
        { name: 'Home', path: '/' },
        { name: 'Posts', path: '/posts' },
        { name: headline, path: postUrl(post) },
      ]),
    ],
  };
}
