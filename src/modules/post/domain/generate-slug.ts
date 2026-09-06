import { slugify } from '../../../core/helpers/slug.helper.js';

// Post `slug` (PLAN.md §4): derived from the title, capped at 80 chars. Not
// unique on its own — the public URL's uniqueness comes from the trailing
// `shortId` (see post.entity.ts / parse-slug-id.ts).
export function generateSlug(title: string): string {
  return slugify(title, { maxLength: 80 });
}
