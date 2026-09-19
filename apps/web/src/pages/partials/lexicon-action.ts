import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import {
  LEXICON_ACTION_MESSAGE,
  type LexiconTarget,
  lexiconActionsHtml,
} from '../../lib/reader-lexicon';
import type { LearningCard } from '../../lib/types';

// HTMX target for the "+" / "I know it" buttons in the reader's word/phrase
// popup. Forwards to Nest `POST /learning/cards` or `POST
// /learning/dispositions` and returns the popup's action row in its new state.
// Both writes fully determine the resulting state (a card is Learning, a known
// disposition is Learned), so no re-fetch is needed. On a failure the row
// stays as it was, with a message.

function fragment(html: string): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function readTarget(form: FormData): LexiconTarget | null {
  const wordDefinitionId = form.get('wordDefinitionId');
  if (typeof wordDefinitionId === 'string' && wordDefinitionId) {
    return { kind: 'word', id: wordDefinitionId };
  }
  const phraseId = form.get('phraseId');
  if (typeof phraseId === 'string' && phraseId) {
    return { kind: 'phrase', id: phraseId };
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const target = readTarget(form);
  const action = form.get('action');

  if (!target || (action !== 'add' && action !== 'known')) {
    return new Response('Bad request', { status: 400 });
  }

  const ref =
    target.kind === 'word'
      ? { wordDefinitionId: target.id }
      : { phraseId: target.id };

  try {
    if (action === 'add') {
      await apiPost<LearningCard>('/learning/cards', ref, { request });
    } else {
      await apiPost(
        '/learning/dispositions',
        { ...ref, disposition: 'known' },
        { request },
      );
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return fragment(
        lexiconActionsHtml(target, 'new', LEXICON_ACTION_MESSAGE.signIn),
      );
    }
    if (error instanceof ApiError && error.status === 400) {
      return fragment(
        lexiconActionsHtml(target, 'new', LEXICON_ACTION_MESSAGE.deckFull),
      );
    }
    return fragment(
      lexiconActionsHtml(target, 'new', LEXICON_ACTION_MESSAGE.failed),
    );
  }

  return fragment(
    lexiconActionsHtml(target, action === 'add' ? 'learning' : 'learned'),
  );
};
