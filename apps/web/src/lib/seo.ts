export interface Crumb {
  name: string;
  // Root-relative path; joined with the public origin.
  path: string;
}

// schema.org BreadcrumbList node; the trail is listed in order, Home first.
export function breadcrumbList(
  origin: string,
  crumbs: Crumb[],
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${origin}${crumb.path}`,
    })),
  };
}

// `<` is escaped so the JSON can't close its own <script> element.
export function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

// One JSON-LD document holding several nodes.
export function jsonLdGraph(nodes: Record<string, unknown>[]): string {
  return escapeJson({ '@context': 'https://schema.org', '@graph': nodes });
}
