const HOP_COUNT_RE = /^\d+$/;

export function parseTrustProxy(raw: string | undefined): boolean | string[] {
  if (!raw) {
    return [];
  }

  const tokens = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 1) {
    const token = tokens[0];

    if (token.toLowerCase() === 'true') {
      return true;
    }

    if (token.toLowerCase() === 'false') {
      return false;
    }
  }

  // Fastify >=5.12.1 fails closed on a numeric hop count (a direct client could
  // spoof X-Forwarded-For), so `TRUST_PROXY=1` would silently stop resolving the
  // real client IP. Reject it at startup instead.
  if (tokens.some((token) => HOP_COUNT_RE.test(token))) {
    throw new Error(
      'TRUST_PROXY: hop counts are not supported; use IP/CIDR entries or the proxy-addr keywords loopback, linklocal, uniquelocal',
    );
  }

  return tokens;
}
