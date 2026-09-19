import type { APIRoute } from 'astro';
import { ApiError, apiGet, apiPost } from '../../lib/api';
import { renderPracticeQueue } from '../../lib/practice-card';
import { parseTypesParam, typesQuery } from '../../lib/practice-filter';
import type { LearningCard, PracticeQueueResponse } from '../../lib/types';

// HTMX target for the /practice grade buttons. Grades the card via Nest, then
// re-fetches the queue and returns the next card (or the "all caught up"
// state) to swap into #practice-container. The active type filter comes back
// as a hidden `types` field on the grade form.

function html(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const cardId = form.get('cardId');
  const rating = form.get('rating');
  const typesField = form.get('types');
  const typeFilter = parseTypesParam(
    typeof typesField === 'string' ? typesField : null,
  );

  if (typeof cardId !== 'string' || typeof rating !== 'string') {
    return html('<p class="practice__answer--self">Something went wrong.</p>');
  }

  try {
    await apiPost<LearningCard>(
      `/learning/cards/${encodeURIComponent(cardId)}/review`,
      { rating },
      { request },
    );
    const filterQuery = typesQuery(typeFilter);
    const next = await apiGet<PracticeQueueResponse>(
      `/learning/practice?limit=20${filterQuery ? `&${filterQuery}` : ''}`,
      { request },
    );
    return html(renderPracticeQueue(next, typeFilter));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return html('<p><a href="/login">Sign in</a> to keep reviewing.</p>');
    }
    return html(
      '<p class="practice__answer--self">Could not save that grade — try again.</p>',
    );
  }
};
