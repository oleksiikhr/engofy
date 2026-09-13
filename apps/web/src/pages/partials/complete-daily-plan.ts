import type { APIRoute } from 'astro';
import { apiPost } from '../../lib/api';

// Крок 3's "Finish for today" button (daily-session-home plan, зріз 4) — a
// plain form POST (not HTMX), since finishing swaps the whole page over to
// крок 4's final screen. `POST /home/daily-plan/complete` is idempotent, so a
// duplicate submit (double click, back button) just keeps the first
// completedAt — safe to call again on the `/` redirect below.
export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    await apiPost('/home/daily-plan/complete', undefined, { request });
  } catch {
    // A guest (401) or a transient failure both just land back on `/`, where
    // the session state (still incomplete) speaks for itself.
  }
  return redirect('/');
};
