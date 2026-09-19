import type { APIRoute } from 'astro';
import { apiPost } from '../../lib/api';
import { REPORT_DONE_HTML } from '../../lib/reader-lexicon';

// HTMX target for the popup's "Report a mistake" button. Forwards to Nest
// `POST /content/posts/{slugId}/label-reports` and swaps the button for a
// thanks note. A failed report keeps the button so it can be retried.

const KINDS = new Set(['word', 'phrase', 'grammar']);

function fragment(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const slugId = form.get('slugId');
  const kind = form.get('kind');
  const targetId = form.get('targetId');

  if (
    typeof slugId !== 'string' ||
    !slugId ||
    typeof kind !== 'string' ||
    !KINDS.has(kind) ||
    typeof targetId !== 'string' ||
    !targetId
  ) {
    return new Response('Bad request', { status: 400 });
  }

  try {
    await apiPost(
      `/content/posts/${encodeURIComponent(slugId)}/label-reports`,
      { kind, targetId },
      { request },
    );
  } catch {
    return new Response(null, { status: 204 });
  }
  return fragment(REPORT_DONE_HTML);
};
