import type { EntityManager } from '@mikro-orm/postgresql';
import { collectSpanNodes } from '../../src/modules/post/domain/collect-spans.js';
import type {
  PendingPhrase,
  PendingWord,
} from '../../src/modules/post/domain/enrichment-prompt.js';
import { parseDoc } from '../../src/modules/post/domain/node-tree.parser.js';
import { assembleDocFromParts } from '../../src/modules/post/domain/post-parts.js';
import { Phrase } from '../../src/modules/post/entities/phrase.entity.js';
import { Post } from '../../src/modules/post/entities/post.entity.js';
import { PostPart } from '../../src/modules/post/entities/post-part.entity.js';
import { Word } from '../../src/modules/post/entities/word.entity.js';
import { WordDefinition } from '../../src/modules/post/entities/word-definition.entity.js';

export interface PostLexicon {
  postId: string;
  shortId: string;
  title: string | null;
  words: PendingWord[];
  phrases: PendingPhrase[];
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

// Read-only mirror of EnrichLexiconHandler's collectPostLexicon +
// loadPending: same node-tree span walk (collectSpanNodes over
// parseDoc(assembleDocFromParts(parts))) to find every wordDefinitionId /
// phraseId this post's spans reference, then the referenced Word /
// WordDefinition / Phrase rows.
//
// One deliberate difference from production: this harness does NOT filter
// to `definition IS NULL`. EnrichLexiconHandler only ever sends pending
// (unfilled) rows — sending nothing once a post is fully enriched, by
// design (PLAN.md §17 Track A gap-fill). A snapshot baseline needs a stable,
// repeatable target set across runs regardless of whether an earlier run
// already filled these rows in the dev DB, so this loads the post's FULL
// referenced lexicon every time — closer to the grammar harness's static
// EGP catalogue than to production's incremental gap-fill.
export async function loadPostLexicon(
  em: EntityManager,
  shortId: string,
): Promise<PostLexicon> {
  const post = await em.findOneOrFail(Post, { shortId });
  const parts = await em.find(
    PostPart,
    { postId: post.id },
    { orderBy: { blockIndex: 'asc' } },
  );
  const doc = parseDoc(assembleDocFromParts(parts));
  const spans = collectSpanNodes(doc.children);

  const wordDefinitionIds = unique(
    spans.map((span) => (span.kind === 'word' ? span.wordDefinitionId : null)),
  );
  const phraseIds = unique(
    spans.map((span) => (span.kind === 'phrase' ? span.phraseId : null)),
  );

  const wordDefs =
    wordDefinitionIds.length === 0
      ? []
      : await em.find(WordDefinition, { id: { $in: wordDefinitionIds } });
  const words =
    wordDefs.length === 0
      ? []
      : await em.find(Word, {
          id: { $in: unique(wordDefs.map((def) => def.wordId)) },
        });
  const wordById = new Map(words.map((word) => [word.id, word]));

  const pendingWords: PendingWord[] = wordDefs.map((definition) => ({
    wordDefinitionId: definition.id,
    lemma: wordById.get(definition.wordId)?.lemma ?? '',
    pos: definition.pos,
  }));

  const phrases =
    phraseIds.length === 0
      ? []
      : await em.find(Phrase, { id: { $in: phraseIds } });
  const pendingPhrases: PendingPhrase[] = phrases.map((phrase) => ({
    phraseId: phrase.id,
    phraseText: phrase.phraseText,
    type: phrase.type ?? null,
  }));

  return {
    postId: post.id,
    shortId: post.shortId,
    title: post.title ?? null,
    words: pendingWords,
    phrases: pendingPhrases,
  };
}
