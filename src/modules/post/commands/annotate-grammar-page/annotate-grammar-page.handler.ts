import { EntityManager } from '@mikro-orm/postgresql';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NLP_CLIENT,
  type NlpClient,
} from '../../../../core/nlp/nlp-client.port.js';
import {
  buildLexBlockSpans,
  type LexBlockSpan,
  lexBlockHash,
} from '../../domain/lex-block.js';
import { upsertPhraseId } from '../../domain/upsert-phrase-id.js';
import { upsertWordDefinition } from '../../domain/upsert-word-definition.js';
import { loadWordFrequencyRanks } from '../../domain/word-frequency.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import {
  GrammarPageLexBlock,
  type GrammarPageLexSpan,
} from '../../entities/grammar-page-lex-block.entity.js';
import { GrammarConstructionNotFoundError } from '../../errors/grammar-construction-not-found.error.js';
import {
  type AnnotatedGrammarPageView,
  AnnotateGrammarPageCommand,
} from './annotate-grammar-page.command.js';

// Makes a handcrafted grammar page's words and phrases clickable: every text
// block the page has now is parsed by spaCy (only blocks with no row for their
// hash — unchanged text is not re-parsed; `refresh` re-parses all, e.g. after
// the phrase list changed) and its content words linked to Word /
// WordDefinition by lemma + part of speech, phrasal verbs and the listed
// phrases to Phrase — the same deterministic rule as an article's word layer. No AI call: the definitions themselves come from the
// enrichment job or a hand-written seed. Rows for blocks the page no longer
// has are removed. A word inside a target range (the page's `<mark>`s) is
// linked whatever its part of speech or frequency; a block's targets are only
// read when it is parsed, so `refresh` after editing marks without changing
// the text.
@CommandHandler(AnnotateGrammarPageCommand)
export class AnnotateGrammarPageHandler
  implements ICommandHandler<AnnotateGrammarPageCommand>
{
  constructor(
    private readonly em: EntityManager,
    @Inject(NLP_CLIENT) private readonly nlp: NlpClient,
  ) {}

  async execute(
    command: AnnotateGrammarPageCommand,
  ): Promise<AnnotatedGrammarPageView> {
    const construction = await this.em.findOne(GrammarConstruction, {
      slug: command.slug,
    });
    if (!construction) {
      throw new GrammarConstructionNotFoundError(command.slug);
    }

    const blockByHash = new Map(
      command.blocks
        .filter((block) => block.text.trim())
        .map((block) => [lexBlockHash(block.text), block]),
    );
    const existing = await this.em.find(GrammarPageLexBlock, {
      constructionId: construction.id,
    });
    const stale = existing.filter((row) => !blockByHash.has(row.textHash));
    this.em.remove(stale);

    // A refresh re-parses kept blocks too, updating their row in place.
    const rowByHash = new Map(
      existing
        .filter((row) => blockByHash.has(row.textHash))
        .map((row) => [row.textHash, row]),
    );
    const pending = [...blockByHash].filter(
      ([hash]) => command.refresh || !rowByHash.has(hash),
    );
    const ranks = await loadWordFrequencyRanks();
    const ids = new Map<string, string>();

    for (const [hash, { text, targets }] of pending) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one nlp-service call at a time, and each upsert must see the previous block's ids.
      const parsed = await this.nlp.parse(text);
      const spans: GrammarPageLexSpan[] = [];
      for (const span of buildLexBlockSpans(
        text,
        parsed,
        ranks,
        command.phrases,
        targets,
      )) {
        // biome-ignore lint/performance/noAwaitInLoops: see above.
        spans.push(await this.linkSpan(span, ids));
      }

      const block = rowByHash.get(hash) ?? new GrammarPageLexBlock();
      block.constructionId = construction.id;
      block.textHash = hash;
      block.spans = spans;
      this.em.persist(block);
    }

    return {
      blocks: blockByHash.size,
      parsed: pending.length,
      removed: stale.length,
    };
  }

  // Finds or creates the WordDefinition / Phrase a span links to; `ids`
  // caches them by lemma + part of speech or phrase text across the page.
  private async linkSpan(
    span: LexBlockSpan,
    ids: Map<string, string>,
  ): Promise<GrammarPageLexSpan> {
    const { start, end } = span;
    if (span.kind === 'word') {
      const key = `word ${span.lemma.toLowerCase()} ${span.pos}`;
      const wordDefinitionId =
        ids.get(key) ??
        (await upsertWordDefinition(this.em, span.lemma, span.pos))
          .wordDefinitionId;
      ids.set(key, wordDefinitionId);
      return { start, end, wordDefinitionId };
    }
    const key = `phrase ${span.phraseText.toLowerCase()}`;
    const phraseId =
      ids.get(key) ??
      (await upsertPhraseId(this.em, span.phraseText, span.phraseType));
    ids.set(key, phraseId);
    return { start, end, phraseId };
  }
}
