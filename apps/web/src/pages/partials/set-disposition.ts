import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import { senseActionsHtml } from '../../lib/dictionary-detail';
import type { DispositionResponse } from '../../lib/types';

// HTMX target for the /dictionary/words/[lemma] "Позначити вивченим" /
// "Пропустити" buttons. Forwards to Nest `POST /learning/dispositions`;
// setting a disposition never creates a card, so the resulting effective
// state is fully determined by the disposition just written — no re-fetch
// needed, unlike /partials/remove-card.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const wordDefinitionId = form.get('wordDefinitionId');
  const lemma = form.get('lemma');
  const disposition = form.get('disposition');

  if (
    typeof wordDefinitionId !== 'string' ||
    typeof lemma !== 'string' ||
    (disposition !== 'known' && disposition !== 'skipped')
  ) {
    return new Response('Bad request', { status: 400 });
  }

  try {
    await apiPost<DispositionResponse>(
      '/learning/dispositions',
      { wordDefinitionId, disposition },
      { request },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return new Response(
        '<span><a href="/login">Sign in</a> to save this.</span>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }
    return new Response('<span>Could not save, try again.</span>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const html = senseActionsHtml(lemma, {
    wordDefinitionId,
    cardId: null,
    state: disposition === 'known' ? 'learned' : 'skipped',
  });
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};
