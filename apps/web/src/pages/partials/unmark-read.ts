import type { APIRoute } from 'astro';
import { ApiError, apiDelete } from '../../lib/api';

// Target for the reader's "Mark as unread" button: forwards to Nest
// `DELETE /content/posts/{slugId}/read`. Same status contract as
// `/partials/mark-read`.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const slugId = form.get('slugId');
  if (typeof slugId !== 'string' || !slugId) {
    return new Response(null, { status: 400 });
  }

  try {
    await apiDelete(`/content/posts/${encodeURIComponent(slugId)}/read`, {
      request,
    });
  } catch (error) {
    return new Response(null, {
      status: error instanceof ApiError && error.status === 401 ? 401 : 502,
    });
  }

  return new Response(null, { status: 204 });
};
