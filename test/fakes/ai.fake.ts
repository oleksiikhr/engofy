import type {
  AiClient,
  AiCompleteParams,
  AiCompleteStructuredParams,
} from '../../src/core/ai/ai-client.port.js';

type CompleteHandler = (params: AiCompleteParams) => string | Promise<string>;
type StructuredHandler = (
  params: AiCompleteStructuredParams<unknown>,
) => unknown;

/**
 * Canonical `AiClient` fake for the integration suites. Each method delegates
 * to a handler the spec sets (`onComplete` / `onCompleteStructured`); the
 * default handler throws, so a stage that unexpectedly calls the model fails
 * loudly instead of silently getting `undefined`.
 *
 * Replaces the bespoke `FakeAiClient` copies in `annotate-post` /
 * `assess-complexity` / `generate-exercises` / `tag-grammar` (Batch I / D17).
 */
export class FakeAiClient implements AiClient {
  completeCallCount = 0;
  structuredCallCount = 0;

  onComplete: CompleteHandler = () => {
    throw new Error('FakeAiClient.complete called but onComplete is not set');
  };

  onCompleteStructured: StructuredHandler = () => {
    throw new Error(
      'FakeAiClient.completeStructured called but onCompleteStructured is not set',
    );
  };

  async complete(params: AiCompleteParams): Promise<string> {
    this.completeCallCount += 1;
    return this.onComplete(params);
  }

  async completeStructured<T>(
    params: AiCompleteStructuredParams<T>,
  ): Promise<T> {
    this.structuredCallCount += 1;
    return this.onCompleteStructured(
      params as AiCompleteStructuredParams<unknown>,
    ) as T;
  }
}
