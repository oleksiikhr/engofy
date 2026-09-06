import type {
  NlpClient,
  NlpParseResult,
  NlpToken,
} from '../../src/core/nlp/nlp-client.port.js';

/**
 * Per-word overrides for the deterministic parse. Keyed by the **lowercased**
 * token text. Anything not listed gets `pos: 'X'`, `tag: 'XX'`, `dep: 'dep'`,
 * `head` = the token's own index, `lemma` = the lowercased text.
 */
export type NlpTokenOverride = Partial<
  Pick<NlpToken, 'lemma' | 'pos' | 'tag' | 'dep' | 'head' | 'morph'>
>;

/**
 * Canonical `NlpClient` fake for the integration suites. Splits the input on
 * whitespace into one sentence with exact char offsets, then stamps each token
 * from `overrides` so a spec only has to declare the pos/tag/dep/head its
 * handler's deterministic rules key off.
 *
 * Replaces the bespoke `FakeNlpClient` copies in `spacy-parse-post` /
 * `annotate-post` (Batch I / D17).
 */
export class FakeNlpClient implements NlpClient {
  callCount = 0;

  constructor(
    private readonly overrides: Record<string, NlpTokenOverride> = {},
  ) {}

  async parse(text: string): Promise<NlpParseResult> {
    this.callCount += 1;

    const tokens: NlpToken[] = [];
    const wordRe = /\S+/g;
    let match: RegExpExecArray | null = wordRe.exec(text);
    let index = 0;

    while (match !== null) {
      const raw = match[0];
      const o = this.overrides[raw.toLowerCase()] ?? {};
      tokens.push({
        index,
        text: raw,
        lemma: o.lemma ?? raw.toLowerCase(),
        pos: o.pos ?? 'X',
        tag: o.tag ?? 'XX',
        dep: o.dep ?? 'dep',
        morph: o.morph ?? {},
        head: o.head ?? index,
        start: match.index,
        end: match.index + raw.length,
      });
      index += 1;
      match = wordRe.exec(text);
    }

    return { sentences: [{ text, start: 0, end: text.length, tokens }] };
  }
}
