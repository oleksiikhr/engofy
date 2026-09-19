import type { APIRoute } from 'astro';
import { apiPost } from '../../lib/api';

// Fire-and-forget target for the reader's mark-read trigger (PLAN.md
// §16/§17 Track B): forwards to Nest `POST /content/posts/{slugId}/read`
// with the visitor's session cookie. No UI reads the result — a guest (401)
// or repeat submit both no-op silently, same as the mark-read command itself.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  // Same `{slug}-{shortId}` param the reader URL and the GET route use —
  // Nest's `parseSlugId` extracts the short id server-side.
  const slugId = form.get('slugId');
  if (typeof slugId !== 'string' || !slugId) {
    return new Response(null, { status: 400 });
  }

  try {
    await apiPost(
      `/content/posts/${encodeURIComponent(slugId)}/read`,
      undefined,
      { request },
    );
  } catch {
    // Best-effort groundwork (no consumer reads post_reads yet) — never
    // surface a failure to the reader.
  }

  return new Response(null, { status: 204 });
};
