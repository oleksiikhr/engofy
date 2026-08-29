import type { NlpParseResult } from '../../src/core/nlp/nlp-client.port.js';

// Standalone transport to the nlp-service, the direct equivalent of
// src/core/nlp/http-nlp-client.service.ts — this harness has no Nest DI to
// hand it the real NlpClient. Kept deliberately tiny: it is only a POST, so
// there is nothing here that could skew a recorded baseline the way a shared
// pricing table could (see call-claude.ts's comment).
const TRAILING_SLASH = /\/$/;

function baseUrl(): string {
  return (
    process.env.NLP_SERVICE_URL ?? 'http://127.0.0.1:8000'
  ).replace(TRAILING_SLASH, '');
}

export async function callNlp(text: string): Promise<NlpParseResult> {
  const url = `${baseUrl()}/parse`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(
      `nlp-service request failed: ${url} — is it running? ` +
        '(cd nlp-service && .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000)',
      { cause: err },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `nlp-service responded ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
    );
  }

  return (await response.json()) as NlpParseResult;
}
