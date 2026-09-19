import type { APIRoute } from 'astro';
import { ApiError, apiDelete, apiGet } from '../../lib/api';
import {
  type ActionTarget,
  actionsHtml,
  readActionTarget,
} from '../../lib/dictionary-detail';
import type {
  PhraseDictionaryDetail,
  WordDictionaryDetail,
} from '../../lib/types';

// HTMX target for the /dictionary/words/[lemma] and
// /dictionary/phrases/[phrase] "Видалити" button. Forwards to Nest
// `DELETE /learning/cards/:cardId`. Unlike /partials/set-disposition,
// the resulting state isn't locally derivable — RemoveCardHandler either
// hard-deletes (unreviewed card, -> New) or archives-with-Known-disposition
// (reviewed card, -> Learned) depending on server-side `reps`, which this
// page never fetched — so this route re-fetches the detail and renders
// the actual resulting state.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const cardId = form.get('cardId');
  const target = readActionTarget(form);

  if (typeof cardId !== 'string' || !target) {
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
    const html = await resultingActionsHtml(target, request);
    return new Response(html ?? '<span>Removed.</span>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('<span>Removed.</span>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
};

async function resultingActionsHtml(
  target: ActionTarget,
  request: Request,
): Promise<string | null> {
  if (target.kind === 'word') {
    const detail = await apiGet<WordDictionaryDetail>(
      `/dictionary/words/${encodeURIComponent(target.lemma)}`,
      { request },
    );
    const sense = detail.senses.find(
      (s) => s.wordDefinitionId === target.wordDefinitionId,
    );
    return sense ? actionsHtml(target, sense) : null;
  }
  const detail = await apiGet<PhraseDictionaryDetail>(
    `/dictionary/phrases/${encodeURIComponent(target.phraseText)}`,
    { request },
  );
  return actionsHtml(target, detail);
}
