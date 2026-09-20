import type { APIRoute } from 'astro';
import { ApiError, apiPost } from '../../lib/api';
import { TARGET_FIELD } from '../../lib/reader-lexicon';
import type { LearningCard } from '../../lib/types';

// Target for the deck a guest built in the reader (lib/guest-deck.ts): the
// first signed-in page load posts the saved entries here and each becomes a
// card through Nest `POST /learning/cards`. A 401 leaves the deck in the
// browser; a full free deck (400) stops the import, as the rest would fail
// the same way.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 100;

function isKind(value: unknown): value is keyof typeof TARGET_FIELD {
  return typeof value === 'string' && value in TARGET_FIELD;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!Array.isArray(body)) {
    return new Response('Bad request', { status: 400 });
  }

  let imported = 0;
  for (const entry of body.slice(0, MAX_ENTRIES)) {
    const { kind, id } = (entry ?? {}) as Record<string, unknown>;
    if (!isKind(kind) || typeof id !== 'string' || !UUID.test(id)) {
      continue;
    }
    try {
      await apiPost<LearningCard>(
        '/learning/cards',
        { [TARGET_FIELD[kind]]: id },
        { request },
      );
      imported += 1;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return new Response(null, { status: 401 });
      }
      if (error instanceof ApiError && error.status === 400) {
        break;
      }
    }
  }

  return Response.json({ imported });
};
