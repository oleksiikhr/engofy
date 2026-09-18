import type { APIRoute } from 'astro';
import { ApiError, apiGet } from '../../lib/api';
import { renderPracticeQueue } from '../../lib/practice-card';
import type { PracticeQueueResponse } from '../../lib/types';

// HTMX target for the /practice "Show N more new" button — re-fetches the
// queue with the daily new-card cap bypassed for this request only
// (practice-redesign зріз 2); the bypass isn't persisted anywhere, so a plain
// reload of /practice reapplies the cap.

function html(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const next = await apiGet<PracticeQueueResponse>(
      '/learning/practice?limit=20&bypassNewLimit=true',
      { request },
    );
    return html(renderPracticeQueue(next));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return html('<p><a href="/login">Sign in</a> to keep reviewing.</p>');
    }
    return html(
      '<p class="practice__answer--self">Could not load more cards — try again.</p>',
    );
  }
};
