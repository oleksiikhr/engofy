// Parses an admin chat message into a bot command (PLAN.md §3.9). Only two
// commands exist in V1: `/add <text>` ingests a new post from the pasted
// text, `/retry <post_id>` re-runs the whole pipeline for an existing post.
// The `@botname` suffix Telegram appends in group chats is tolerated.

export type TelegramCommand =
  | { kind: 'add'; text: string }
  | { kind: 'retry'; postId: string }
  | { kind: 'unknown' };

const ADD_RE = /^\/add(?:@\w+)?\s+([\s\S]+)$/;
const RETRY_RE = /^\/retry(?:@\w+)?\s+(\S+)\s*$/;
// Post ids are uuid v7. `/retry` with anything that isn't a uuid is treated as
// `unknown` here so a bad id can't reach `findOneOrFail` and echo a raw pg
// `invalid input syntax for type uuid` back into the admin chat.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTelegramCommand(rawText: string): TelegramCommand {
  const text = rawText.trim();

  const add = ADD_RE.exec(text);
  if (add) {
    const body = add[1].trim();
    return body ? { kind: 'add', text: body } : { kind: 'unknown' };
  }

  const retry = RETRY_RE.exec(text);
  if (retry) {
    const postId = retry[1];
    return UUID_RE.test(postId)
      ? { kind: 'retry', postId }
      : { kind: 'unknown' };
  }

  return { kind: 'unknown' };
}
