import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import type { LearningCard } from '../../lib/types';

// HTMX target for the inline "+" button in the reader tooltip (PLAN.md §2, §6).
// The button POSTs one of wordId / phraseId / grammarUsagePointId here; this
// route calls Nest `POST /learning/cards` with the visitor's session cookie
// and returns a small HTML fragment that HTMX swaps in place of the form.
//
// Registration happens on the first save-requiring action, so a guest (401)
// gets a prompt to sign in rather than an error.

const TARGET_KEYS = ['wordId', 'phraseId', 'grammarUsagePointId'] as const;

function fragment(html: string): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const body: Record<string, string> = {};
  for (const key of TARGET_KEYS) {
    const value = form.get(key);
    if (typeof value === 'string' && value) {
      body[key] = value;
    }
  }

  if (Object.keys(body).length !== 1) {
    return fragment('<span class="add-card__msg">Nothing to save.</span>');
  }

  try {
    await apiPost<LearningCard>('/learning/cards', body, { request });
    return fragment(
      '<span class="add-card__msg add-card__msg--ok">✓ Saved</span>',
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return fragment(
        '<span class="add-card__msg">' +
          '<a href="/login">Sign in</a> to save this to your deck.' +
          '</span>',
      );
    }
    if (error instanceof ApiError && error.status === 400) {
      return fragment(
        '<span class="add-card__msg">' +
          'Free deck is full — <a href="/pricing">go Premium</a> for unlimited cards.' +
          '</span>',
      );
    }
    return fragment(
      '<span class="add-card__msg add-card__msg--err">Could not save, try again.</span>',
    );
  }
};
