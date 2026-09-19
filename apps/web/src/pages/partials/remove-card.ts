import type { APIRoute } from 'astro';
import { ApiError, apiDelete, apiGet } from '../../lib/api';
import { senseActionsHtml } from '../../lib/dictionary-detail';
import type { WordDictionaryDetail } from '../../lib/types';

// HTMX target for the /dictionary/words/[lemma] "Видалити" button. Forwards
// to Nest `DELETE /learning/cards/:cardId`. Unlike /partials/set-disposition,
// the resulting state isn't locally derivable — RemoveCardHandler either
// hard-deletes (unreviewed card, -> New) or archives-with-Known-disposition
// (reviewed card, -> Learned) depending on server-side `reps`, which this
// page never fetched — so this route re-fetches the word detail and renders
// the actual resulting sense.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const cardId = form.get('cardId');
  const wordDefinitionId = form.get('wordDefinitionId');
  const lemma = form.get('lemma');

  if (
    typeof cardId !== 'string' ||
    typeof wordDefinitionId !== 'string' ||
    typeof lemma !== 'string'
  ) {
    return new Response('Bad request', { status: 400 });
  }

  try {
    await apiDelete(`/learning/cards/${encodeURIComponent(cardId)}`, {
      request,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return new Response(
        '<span><a href="/login">Sign in</a> to manage your dictionary.</span>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }
    return new Response('<span>Could not remove, try again.</span>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const detail = await apiGet<WordDictionaryDetail>(
      `/dictionary/words/${encodeURIComponent(lemma)}`,
      { request },
    );
    const sense = detail.senses.find(
      (s) => s.wordDefinitionId === wordDefinitionId,
    );
    const html = sense
      ? senseActionsHtml(lemma, sense)
      : '<span>Removed.</span>';
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('<span>Removed.</span>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
};
