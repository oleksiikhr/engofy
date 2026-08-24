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
