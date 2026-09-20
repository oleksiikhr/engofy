import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import {
  LEXICON_ACTION_MESSAGE,
  type LexiconTarget,
  lexiconActionsHtml,
  TARGET_FIELD,
} from '../../lib/reader-lexicon';
import type { LearningCard } from '../../lib/types';

// HTMX target for the "+" / "I know it" buttons in the reader's popup (word,
// phrase or grammar usage point). Forwards to Nest `POST /learning/cards` or
// `POST /learning/dispositions` and returns the popup's action row in its new
// state.
// Both writes fully determine the resulting state (a card is Learning, a known
// disposition is Learned), so no re-fetch is needed. On a failure the row
// stays as it was, with a message.

function fragment(html: string): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function readTarget(form: FormData): LexiconTarget | null {
  for (const kind of Object.keys(TARGET_FIELD) as LexiconTarget['kind'][]) {
    const id = form.get(TARGET_FIELD[kind]);
    if (typeof id === 'string' && id) {
      return { kind, id };
    }
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

  const ref = { [TARGET_FIELD[target.kind]]: target.id };

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
    action === 'add'
      ? lexiconActionsHtml(target, 'learning', undefined, true)
      : lexiconActionsHtml(target, 'learned'),
  );
};
