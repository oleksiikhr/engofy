import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { IDIOM_SYSTEM_PROMPT } from '../../domain/annotation-prompt.js';
import {
  buildTokenAnnotations,
  type SentenceRows,
} from '../../domain/build-token-annotations.js';
import { dedupeAnnotations } from '../../domain/dedupe-annotations.js';
import { dropIncompleteAnnotations } from '../../domain/drop-incomplete-annotations.js';
import { dropSpansCrossingNodeBoundaries } from '../../domain/drop-spans-crossing-node-boundaries.js';
import type { NodeOffset } from '../../domain/flatten.js';
import { flattenNodes, flattenParagraph } from '../../domain/flatten.js';
import type {
  ListBlock,
  ListItem,
  Paragraph,
} from '../../domain/node-tree.types.js';
import { parseAnnotationTags } from '../../domain/parse-annotation-tags.js';
import { resolvePhraseOverlaps } from '../../domain/resolve-phrase-overlaps.js';
import { resolveWordPhraseOverlaps } from '../../domain/resolve-word-phrase-overlaps.js';
import {
  type SpanInsert,
  spliceSpans,
  spliceSpansIntoListItem,
} from '../../domain/splice-spans.js';
import { upsertPhraseId } from '../../domain/upsert-phrase-id.js';
import type { Annotation } from '../../domain/validate-annotations.js';
import { validateAnnotations } from '../../domain/validate-annotations.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import type { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import { PhraseType } from '../../enums/phrase-type.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { SpacyLayerMissingError } from '../../errors/spacy-layer-missing.error.js';
import { AnnotatePostCommand } from './annotate-post.command.js';

interface WordRef {
  wordId: string;
  wordDefinitionId: string;
}

export interface AnnotationCaches {
  wordRefByKey: Map<string, WordRef>;
  phraseIdByText: Map<string, string>;
}

// A sentence_tokens row loaded for one flattened unit, plus the parent
// sentence's offset so token spans can be re-based onto unit coordinates.
interface LoadedSentence {
  charStart: number;
  tokens: SentenceToken[];
}

// Where one resolved annotation lands and what it links to — used both to
// splice the node tree and to back-link sentence_tokens.word_id / phrase_id.
interface ResolvedLink {
  start: number;
  end: number;
  wordId?: string;
  phraseId?: string;
  isIdiomPart: boolean;
}

// Annotation stage (PLAN.md §5, §6, §12): the node-tree lexical layer, built
// as a thin AI pass over spaCy. Word and phrasal-verb spans come straight
// from sentence_tokens (deterministic, no LLM); the LLM is called only for
// multi-word idioms / collocations spaCy can't see. Runs after spacy_parse
// (which enqueues it on completion) and back-links
// sentence_tokens.word_id / phrase_id so the two layers meet on Word /
// Phrase.
//
// Idempotency is the stage-level PostPipelineRun row (§12). Flush is once
// per PostPart so a crash keeps finished parts — a part with annotatedAt set
// is skipped on retry. AnnotatePostHandler deliberately breaks the
// "handler doesn't flush" convention for exactly this.
@CommandHandler(AnnotatePostCommand)
export class AnnotatePostHandler
  implements ICommandHandler<AnnotatePostCommand>
{
  private readonly logger = new Logger(AnnotatePostHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
  ) {}

  async execute(command: AnnotatePostCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Annotation,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    const post = await this.em.findOneOrFail(Post, postId);

    if ((await this.em.count(Sentence, { postId })) === 0) {
      throw new SpacyLayerMissingError(postId);
    }

    if (post.status === PostStatus.Pending) {
      post.status = PostStatus.Annotating;
      await this.em.flush();
    }

    const parts = await this.em.find(
      PostPart,
      { postId },
      { orderBy: { blockIndex: 'asc' } },
    );

    const caches: AnnotationCaches = {
      wordRefByKey: new Map(),
      phraseIdByText: new Map(),
    };

    for (const part of parts) {
      if (part.annotatedAt) {
        continue;
      }

      if (part.kind === PostPartKind.Paragraph) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — shares caches with prior parts and the flush below must land before the next iteration starts.
        await this.annotateParagraphPart(part, caches);
      } else {
        await this.annotateListPart(part, caches);
      }

      part.annotatedAt = DateTime.now();
      await this.em.flush();
    }

    post.status = PostStatus.Annotated;

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.Annotation;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    await this.em.flush();
  }

  private async annotateParagraphPart(
    part: PostPart,
    caches: AnnotationCaches,
  ): Promise<void> {
    const paragraph = part.body as Paragraph;
    const { text, offsets } = flattenParagraph(paragraph);

    if (!text.trim()) {
      return;
    }

    const unitSentences = await this.loadUnitSentences(part.id, 0);
    const annotations = await this.computeAnnotations(
      text,
      offsets,
      unitSentences,
    );
    const { inserts, links } = await this.buildSpanInserts(annotations, caches);

    part.body = spliceSpans(paragraph, inserts);
    this.linkSentenceTokens(unitSentences, links);
  }

  private async annotateListPart(
    part: PostPart,
    caches: AnnotationCaches,
  ): Promise<void> {
    const list = part.body as ListBlock;
    const items: ListItem[] = [];

    for (const [unitIndex, item] of list.items.entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each item's find-or-create must see the previous item's not-yet-flushed Word/Phrase via the cache.
      items.push(await this.annotateListItem(part.id, unitIndex, item, caches));
    }

    part.body = { ...list, items };
  }

  private async annotateListItem(
    postPartId: string,
    unitIndex: number,
    item: ListItem,
    caches: AnnotationCaches,
  ): Promise<ListItem> {
    const { text, offsets } = flattenNodes(item.children);
    if (!text.trim()) {
      return item;
    }

    const unitSentences = await this.loadUnitSentences(postPartId, unitIndex);
    const annotations = await this.computeAnnotations(
      text,
      offsets,
      unitSentences,
    );
    const { inserts, links } = await this.buildSpanInserts(annotations, caches);

    const spliced = spliceSpansIntoListItem(item, inserts);
    this.linkSentenceTokens(unitSentences, links);
    return spliced;
  }

  private async loadUnitSentences(
    postPartId: string,
    unitIndex: number,
  ): Promise<LoadedSentence[]> {
    const sentences = await this.em.find(
      Sentence,
      { postPartId, unitIndex },
      { orderBy: { position: 'asc' } },
    );
    if (sentences.length === 0) {
      return [];
    }

    const tokens = await this.em.find(
      SentenceToken,
      { sentenceId: { $in: sentences.map((s) => s.id) } },
      { orderBy: { position: 'asc' } },
    );
    const tokensBySentence = new Map<string, SentenceToken[]>();
    for (const token of tokens) {
      const list = tokensBySentence.get(token.sentenceId) ?? [];
      list.push(token);
      tokensBySentence.set(token.sentenceId, list);
    }

    return sentences.map((sentence) => ({
      charStart: sentence.charStart,
      tokens: tokensBySentence.get(sentence.id) ?? [],
    }));
  }

  // Merges the deterministic spaCy annotations (word + phrasal-verb spans)
  // with the LLM's idiom / collocation spans for the same unit, then runs
  // the same cleanup ladder the all-words prompt used. The LLM still echoes
  // the whole unit text back with only its own tags inline, so
  // parseAnnotationTags can recover offsets and flag a truncated response —
  // annotate on that signal with one retry on the same full text.
  private async computeAnnotations(
    text: string,
    offsets: NodeOffset[],
    sentences: LoadedSentence[],
  ): Promise<Annotation[]> {
    const deterministic = buildTokenAnnotations(
      toSentenceRows(sentences),
      await this.loadPhraseTexts(sentences),
    );

    const first = parseAnnotationTags(text, await this.callIdiomPrompt(text));
    let idioms = first.annotations;
    let isComplete = first.isComplete;

    if (!isComplete) {
      const retry = parseAnnotationTags(text, await this.callIdiomPrompt(text));
      idioms = [...idioms, ...retry.annotations];
      isComplete = retry.isComplete;
    }

    if (!isComplete) {
      this.logger.warn(
        { textLength: text.length },
        'idiom response still incomplete after retry — proceeding with the partial spans found',
      );
    }

    const annotations = dropIncompleteAnnotations(
      dropSpansCrossingNodeBoundaries(
        offsets,
        resolvePhraseOverlaps(
          resolveWordPhraseOverlaps(
            dedupeAnnotations([...deterministic, ...idioms]),
          ),
        ),
      ),
    );

    validateAnnotations(text, annotations);
    return annotations;
  }

  private callIdiomPrompt(text: string): Promise<string> {
    return this.ai.complete({ system: IDIOM_SYSTEM_PROMPT, userText: text });
  }

  // phrases.phrase_text for every phrasal-verb group referenced by these
  // tokens — spacy_parse already created the rows, buildTokenAnnotations
  // just needs their canonical text.
  private async loadPhraseTexts(
    sentences: LoadedSentence[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const sentence of sentences) {
      for (const token of sentence.tokens) {
        if (token.phrasalVerbGroupId) {
          ids.add(token.phrasalVerbGroupId);
        }
      }
    }
    if (ids.size === 0) {
      return new Map();
    }

    const phrases = await this.em.find(Phrase, { id: { $in: [...ids] } });
    return new Map(phrases.map((phrase) => [phrase.id, phrase.phraseText]));
  }

  // Resolves each annotation to a Word/WordDefinition or Phrase (find-or-
  // creating as needed), producing both the node-tree span inserts and the
  // token back-links. Correctness against concurrent jobs comes from the
  // atomic upserts, not from `caches` — that's scoped to one execute() and
  // just avoids redundant round trips for repeats within this run.
  private async buildSpanInserts(
    annotations: Annotation[],
    caches: AnnotationCaches,
  ): Promise<{ inserts: SpanInsert[]; links: ResolvedLink[] }> {
    const phraseIdByGroupId = new Map<string, string>();

    for (const annotation of annotations) {
      if (annotation.kind !== 'phrase') {
        continue;
      }
      const groupId = annotation.phraseGroupId as string;
      if (phraseIdByGroupId.has(groupId)) {
        continue;
      }

      if (annotation.phraseId) {
        phraseIdByGroupId.set(groupId, annotation.phraseId);
        continue;
      }

      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — must see the previous iteration's not-yet-flushed Phrase via `cache`.
      const phraseId = await this.findOrCreatePhraseId(
        annotation.phraseText as string,
        annotation.phraseType,
        caches.phraseIdByText,
      );
      phraseIdByGroupId.set(groupId, phraseId);
    }

    const inserts: SpanInsert[] = [];
    const links: ResolvedLink[] = [];

    for (const annotation of annotations) {
      if (annotation.kind === 'word') {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — must see the previous iteration's not-yet-flushed Word/WordDefinition via `cache`.
        const ref = await this.findOrCreateWordRef(
          annotation.lemma as string,
          annotation.pos as PartOfSpeech,
          caches.wordRefByKey,
        );
        inserts.push({
          kind: 'word',
          start: annotation.start,
          end: annotation.end,
          wordDefinitionId: ref.wordDefinitionId,
          pos: annotation.pos as string,
        });
        links.push({
          start: annotation.start,
          end: annotation.end,
          wordId: ref.wordId,
          isIdiomPart: false,
        });
      } else {
        const groupId = annotation.phraseGroupId as string;
        const phraseId = phraseIdByGroupId.get(groupId) as string;
        inserts.push({
          kind: 'phrase',
          start: annotation.start,
          end: annotation.end,
          phraseId,
        });
        links.push({
          start: annotation.start,
          end: annotation.end,
          phraseId,
          isIdiomPart:
            annotation.phraseType === PhraseType.Idiom ||
            annotation.phraseType === PhraseType.Collocation,
        });
      }
    }

    return { inserts, links };
  }

  // Sets sentence_tokens.word_id / phrase_id (and is_idiom_part) on every
  // token fully inside a resolved span. Mutations ride the caller's
  // per-part flush.
  private linkSentenceTokens(
    sentences: LoadedSentence[],
    links: ResolvedLink[],
  ): void {
    if (links.length === 0) {
      return;
    }

    const tokens = sentences.flatMap((sentence) =>
      sentence.tokens.map((token) => ({
        token,
        start: sentence.charStart + token.charStart,
        end: sentence.charStart + token.charEnd,
      })),
    );

    for (const { token, start, end } of tokens) {
      const link = links.find((l) => l.start <= start && end <= l.end);
      if (link) {
        applyLink(token, link);
      }
    }
  }

  private async findOrCreateWordRef(
    lemma: string,
    pos: PartOfSpeech,
    cache: Map<string, WordRef>,
  ): Promise<WordRef> {
    const key = `${lemma.toLowerCase()} ${pos}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const wordId = await this.upsertWordId(lemma);

    // word_definitions has a real (word_id, pos) unique constraint, so
    // em.upsert() targets it directly — an atomic insert-or-fetch immune to
    // the concurrent-job race. 'ignore' keeps an existing definition's
    // cefrLevel/definition untouched. `id` must be passed explicitly (the
    // entity's field initializer only runs via `new`). cefrLevel is filled
    // in later by the word-definition enrichment job, not here.
    const definition = await this.em.upsert(
      WordDefinition,
      { id: uuidv7(), wordId, pos },
      { onConflictFields: ['wordId', 'pos'], onConflictAction: 'ignore' },
    );

    const ref: WordRef = { wordId, wordDefinitionId: definition.id };
    cache.set(key, ref);
    return ref;
  }

  // Word.lemma's uniqueness is a lower(lemma) expression index, which
  // em.upsert()'s onConflictFields can't target, so this is raw SQL. Two
  // concurrent jobs racing the same lemma resolve atomically at the DB
  // level; the no-op DO UPDATE lets the one round trip return the existing
  // row's id on conflict.
  private async upsertWordId(lemma: string): Promise<string> {
    const rows = await this.em.getConnection().execute<{ id: string }[]>(
      `INSERT INTO words (id, lemma, created_at, updated_at)
         VALUES (?, ?, now(), now())
         ON CONFLICT (lower(lemma)) DO UPDATE SET lemma = words.lemma
         RETURNING id`,
      [uuidv7(), lemma],
      'all',
      this.em.getTransactionContext(),
    );

    return (rows[0] as { id: string }).id;
  }

  private async findOrCreatePhraseId(
    phraseText: string,
    type: string | undefined,
    cache: Map<string, string>,
  ): Promise<string> {
    const key = phraseText.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const phraseId = await upsertPhraseId(
      this.em,
      phraseText,
      (type as PhraseType | undefined) ?? null,
    );

    cache.set(key, phraseId);
    return phraseId;
  }
}

function applyLink(token: SentenceToken, link: ResolvedLink): void {
  if (link.wordId) {
    token.wordId = link.wordId;
  }
  if (link.phraseId) {
    token.phraseId = link.phraseId;
    if (link.isIdiomPart) {
      token.isIdiomPart = true;
    }
  }
}

function toSentenceRows(sentences: LoadedSentence[]): SentenceRows[] {
  return sentences.map((sentence) => ({
    charStart: sentence.charStart,
    tokens: sentence.tokens.map((token) => ({
      text: token.text,
      charStart: token.charStart,
      charEnd: token.charEnd,
      lemma: token.lemma,
      pos: token.pos,
      isGerund: token.isGerund,
      phrasalVerbGroupId: token.phrasalVerbGroupId ?? null,
    })),
  }));
}
