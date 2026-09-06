// The public post URL is `/posts/{slug}-{shortId}` (PLAN.md §4). `shortId` is
// 8 base62 chars (generate-short-id.ts); `slug` is lowercase `[a-z0-9-]` and
// may itself contain hyphens, so the shortId is the final hyphen-separated
// segment. A bare `{shortId}` (no slug prefix, e.g. a post with no title) is
// also accepted.
const SHORT_ID_RE = /^[0-9A-Za-z]{6,16}$/;

export function parseSlugId(slugId: string): string | null {
  const trimmed = slugId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const lastDash = trimmed.lastIndexOf('-');
  const candidate = lastDash === -1 ? trimmed : trimmed.slice(lastDash + 1);

  return SHORT_ID_RE.test(candidate) ? candidate : null;
}
