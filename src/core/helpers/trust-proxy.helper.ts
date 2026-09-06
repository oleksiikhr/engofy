const HOP_COUNT_RE = /^\d+$/;

export function parseTrustProxy(
  raw: string | undefined,
): boolean | string | string[] | number {
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

    // A bare non-negative integer is a hop count (Fastify / proxy-addr: trust
    // the Nth proxy back from the connecting socket). `TRUST_PROXY=1` behind
    // exactly one proxy — cloudflared — resolves the real client IP without
    // trusting a client-supplied X-Forwarded-For. An IP list would need the
    // tunnel's own egress address, which is not stable.
    if (HOP_COUNT_RE.test(token)) {
      return Number(token);
    }
  }

  return tokens;
}
