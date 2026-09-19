import type { APIRoute } from 'astro';
import { apiPost } from '../../lib/api';
import type { LearningCard } from '../../lib/types';

// Fire-and-forget target for the reader's Quick check "recall a word" rating:
// grades the card via Nest with the visitor's session cookie. Unlike
// /partials/review it doesn't re-fetch the practice queue — the quiz has no
// card to swap in. A failure is reported by status only; the client ignores it.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const cardId = form.get('cardId');
  const rating = form.get('rating');
  if (typeof cardId !== 'string' || !cardId || typeof rating !== 'string') {
    return new Response(null, { status: 400 });
  }

  try {
    await apiPost<LearningCard>(
      `/learning/cards/${encodeURIComponent(cardId)}/review`,
      { rating },
      { request },
    );
  } catch {
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
};
