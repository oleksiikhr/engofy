import type { GrammarConstructionDetail, GrammarReference } from './types';

// Search snippets truncate around 155-160 characters.
const DESCRIPTION_MAX = 158;

// Generic per-construction meta description, built from the construction's own
// data. Handcrafted pages pass their own to `GrammarShell` instead.
export function grammarMetaDescription(con: GrammarConstructionDetail): string {
  const level = con.cefrLevel ? ` (${con.cefrLevel})` : '';
  const head = `${con.name}${level} — ${con.categoryName} in English grammar.`;
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
