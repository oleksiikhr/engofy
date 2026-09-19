import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import {
  USAGE_ACTIONS_MESSAGE,
  usageActionsHtml,
} from '../../lib/grammar-usage-actions';
import type { LearningCard } from '../../lib/types';

// HTMX target for the per-usage-point "+ Add to deck" / "I know this" buttons
// on /grammar/[slug]. Forwards to Nest `POST /learning/cards` or
// `POST /learning/dispositions` and returns the usage point's action row in
// its new state. Both writes fully determine the resulting state (a card is
// Learning, a known disposition is Learned), so no re-fetch is needed. On a
// failure the row stays as it was, with a message.

function fragment(html: string): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const usagePointId = form.get('grammarUsagePointId');
  const action = form.get('action');

  if (
    typeof usagePointId !== 'string' ||
    !usagePointId ||
    (action !== 'add' && action !== 'known')
  ) {
    return new Response('Bad request', { status: 400 });
  }

  try {
    if (action === 'add') {
      await apiPost<LearningCard>(
        '/learning/cards',
        { grammarUsagePointId: usagePointId },
        { request },
      );
    } else {
      await apiPost(
        '/learning/dispositions',
        { grammarUsagePointId: usagePointId, disposition: 'known' },
        { request },
      );
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return fragment(
        usageActionsHtml(usagePointId, 'new', USAGE_ACTIONS_MESSAGE.signIn),
      );
    }
    if (error instanceof ApiError && error.status === 400) {
      return fragment(
        usageActionsHtml(usagePointId, 'new', USAGE_ACTIONS_MESSAGE.deckFull),
      );
    }
    return fragment(
      usageActionsHtml(usagePointId, 'new', USAGE_ACTIONS_MESSAGE.failed),
    );
  }

  return fragment(
    usageActionsHtml(usagePointId, action === 'add' ? 'learning' : 'learned'),
  );
};
