export function toUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  const url = toUrl(value);
  if (url === null) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}

const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set([
  'http:',
  'https:',
  'mailto:',
]);

// Guards link hrefs before they are persisted into a stored `LinkNode` and
// later rendered: only absolute `http(s):`/`mailto:` URLs pass. `javascript:`,
// `data:`, and unparseable/relative values are rejected so the caller can
// degrade the link to plain text.
export function isSafeLinkHref(value: string): boolean {
  const url = toUrl(value);
  if (url === null) {
    return false;
  }

  return SAFE_LINK_PROTOCOLS.has(url.protocol);
}
