import { Logger } from '@nestjs/common';
import type { NlpClient, NlpParseResult } from './nlp-client.port.js';

const TRAILING_SLASH = /\/$/;

export class HttpNlpClientService implements NlpClient {
  private readonly logger = new Logger(HttpNlpClientService.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async parse(text: string): Promise<NlpParseResult> {
    const url = `${this.baseUrl.replace(TRAILING_SLASH, '')}/parse`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new Error(`nlp-service request failed: ${url}`, { cause: err });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `nlp-service responded ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
      );
    }

    const result = (await response.json()) as NlpParseResult;

    this.logger.log(
      { textLength: text.length, sentences: result.sentences.length },
      'nlp parse call',
    );

    return result;
  }
}
