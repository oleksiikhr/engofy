import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';

// Target for the reader's "mark as read" — the toggle button, the scroll-to-end
// trigger and study mode's Finish. Forwards to Nest
// `POST /content/posts/{slugId}/read` with the visitor's session cookie. The
// status tells the client whether to keep its optimistic state: 204 on
// success (a repeat is a no-op), 401 for a guest, 502 otherwise.
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
  } catch (error) {
    return new Response(null, {
      status: error instanceof ApiError && error.status === 401 ? 401 : 502,
    });
  }

  return new Response(null, { status: 204 });
};
