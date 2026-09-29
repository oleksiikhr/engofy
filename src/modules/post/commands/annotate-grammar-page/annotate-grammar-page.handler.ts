import { EntityManager } from '@mikro-orm/postgresql';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NLP_CLIENT,
  type NlpClient,
} from '../../../../core/nlp/nlp-client.port.js';
import { buildLexBlockWords, lexBlockHash } from '../../domain/lex-block.js';
import {
  upsertWordDefinition,
  type WordRef,
} from '../../domain/upsert-word-definition.js';
import { loadWordFrequencyRanks } from '../../domain/word-frequency.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarPageLexBlock } from '../../entities/grammar-page-lex-block.entity.js';
import { GrammarConstructionNotFoundError } from '../../errors/grammar-construction-not-found.error.js';
import {
  type AnnotatedGrammarPageView,
  AnnotateGrammarPageCommand,
} from './annotate-grammar-page.command.js';

// Makes a handcrafted grammar page's words clickable: every text block the
// page has now is parsed by spaCy (only blocks with no row for their hash —
// unchanged text is not re-parsed) and its content words linked to Word /
// WordDefinition by lemma + part of speech, the same deterministic rule as an
// article's word layer. No AI call: the definitions themselves come from the
// enrichment job or a hand-written seed. Rows for blocks the page no longer
// has are removed.
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

    const textByHash = new Map(
      command.blocks
        .filter((text) => text.trim())
        .map((text) => [lexBlockHash(text), text]),
    );
    const existing = await this.em.find(GrammarPageLexBlock, {
      constructionId: construction.id,
    });
    const stale = existing.filter((row) => !textByHash.has(row.textHash));
    this.em.remove(stale);

    const known = new Set(existing.map((row) => row.textHash));
    const pending = [...textByHash].filter(([hash]) => !known.has(hash));
    const ranks = await loadWordFrequencyRanks();
    const refs = new Map<string, WordRef>();

    for (const [hash, text] of pending) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one nlp-service call at a time, and each word upsert must see the previous block's refs.
      const parsed = await this.nlp.parse(text);
      const words = [];
      for (const word of buildLexBlockWords(text, parsed, ranks)) {
        const key = `${word.lemma.toLowerCase()} ${word.pos}`;
        const ref =
          refs.get(key) ??
          // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — see above.
          (await upsertWordDefinition(this.em, word.lemma, word.pos));
        refs.set(key, ref);
        words.push({
          start: word.start,
          end: word.end,
          wordDefinitionId: ref.wordDefinitionId,
        });
      }

      const block = new GrammarPageLexBlock();
      block.constructionId = construction.id;
      block.textHash = hash;
      block.words = words;
      this.em.persist(block);
    }

    return {
      blocks: textByHash.size,
      parsed: pending.length,
      removed: stale.length,
    };
  }
}
