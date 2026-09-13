import type { APIRoute } from 'astro';
import { ApiError, apiGet, apiPost } from '../../lib/api';
import { renderDailyPracticeQueue } from '../../lib/practice-card';
import type { LearningCard, PracticeQueueResponse } from '../../lib/types';

// HTMX target for крок 2's grade buttons (daily-session-home plan, зріз 4) —
// same shape as /partials/review, but re-fetches the daily-plan-scoped queue
// (`/home/daily-plan/cards`) so finishing it hands off to крок 3 instead of
// linking away to /practice.

function html(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const cardId = form.get('cardId');
  const rating = form.get('rating');

  if (typeof cardId !== 'string' || typeof rating !== 'string') {
    return html('<p class="practice__answer--self">Something went wrong.</p>');
  }

  try {
    await apiPost<LearningCard>(
      `/learning/cards/${encodeURIComponent(cardId)}/review`,
      { rating },
      { request },
    );
    const next = await apiGet<PracticeQueueResponse>('/home/daily-plan/cards', {
      request,
    });
    return html(renderDailyPracticeQueue(next.items));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return html('<p><a href="/login">Sign in</a> to keep reviewing.</p>');
    }
    return html(
      '<p class="practice__answer--self">Could not save that grade — try again.</p>',
    );
  }
};
