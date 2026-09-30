import type { GrammarConstructionDetail, GrammarReference } from './types';

// Search snippets truncate around 155-160 characters.
const DESCRIPTION_MAX = 158;

// Tense categories already read as a title on their own ("present perfect
// simple" under PAST), so they get no category prefix.
const SELF_EXPLANATORY_CATEGORIES = new Set(['past', 'present', 'future']);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// EGP construction names are unique only within their category ("position",
// "types", "quantity"), and carry list punctuation ("patterns_that clauses",
// "adverb phrases - form"). The page's H1/title/breadcrumb need a readable name
// that stands alone: tidy the punctuation and prefix the category unless the
// name already says it.
export function grammarDisplayName(con: {
  name: string;
  categoryName: string;
}): string {
  const name = con.name
    .replace(/\s+-\s+|_/g, ' — ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
  const category = con.categoryName.toLowerCase();
  const stem = category.replace(/s$/, '');
  if (
    SELF_EXPLANATORY_CATEGORIES.has(category) ||
    name.toLowerCase().includes(stem)
  ) {
    return capitalize(name);
  }
  return `${capitalize(category)}: ${name}`;
}

// Generic per-construction meta description, built from the construction's own
// data. Handcrafted pages pass their own to `GrammarShell` instead.
export function grammarMetaDescription(con: GrammarConstructionDetail): string {
  const level = con.cefrLevel ? ` (${con.cefrLevel})` : '';
  const head = `${grammarDisplayName(con)}${level} in English grammar.`;
  const canDo = con.usagePoints[0]?.canDoStatement;
  return truncate(canDo ? `${head} ${canDo}` : head, DESCRIPTION_MAX);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// Every construction slug across all groups, de-duplicated, in list order.
export function grammarSlugs(reference: GrammarReference): string[] {
  const slugs = new Set<string>();
  for (const group of reference.groups) {
    for (const con of group.constructions) {
      slugs.add(con.slug);
    }
  }
  return [...slugs];
}
