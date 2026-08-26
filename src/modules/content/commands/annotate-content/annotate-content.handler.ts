import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { ANNOTATION_SYSTEM_PROMPT } from '../../domain/annotation-prompt.js';
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
import type { ParseAnnotationTagsResult } from '../../domain/parse-annotation-tags.js';
import { parseAnnotationTags } from '../../domain/parse-annotation-tags.js';
import { resolveWordPhraseOverlaps } from '../../domain/resolve-word-phrase-overlaps.js';
import {
  type SpanInsert,
  spliceSpans,
  spliceSpansIntoListItem,
} from '../../domain/splice-spans.js';
import type { Annotation } from '../../domain/validate-annotations.js';
import { validateAnnotations } from '../../domain/validate-annotations.js';
import { Content } from '../../entities/content.entity.js';
import { ContentPart } from '../../entities/content-part.entity.js';
import { ContentPipelineRun } from '../../entities/content-pipeline-run.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { ContentPartKind } from '../../enums/content-part-kind.enum.js';
import { ContentPipelineRunStatus } from '../../enums/content-pipeline-run-status.enum.js';
import { ContentPipelineStage } from '../../enums/content-pipeline-stage.enum.js';
import { ContentStatus } from '../../enums/content-status.enum.js';
import type { PartOfSpeech } from '../../enums/part-of-speech.enum.js';
import type { PhraseType } from '../../enums/phrase-type.enum.js';
import { AnnotateContentCommand } from './annotate-content.command.js';

export interface AnnotationCaches {
  wordDefinitionIdByKey: Map<string, string>;
  phraseIdByText: Map<string, string>;
}

@CommandHandler(AnnotateContentCommand)
export class AnnotateContentHandler
  implements ICommandHandler<AnnotateContentCommand>
{
  private readonly logger = new Logger(AnnotateContentHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
  ) {}

  async execute(command: AnnotateContentCommand): Promise<void> {
    const { contentId } = command;

    const existingRun = await this.em.findOne(ContentPipelineRun, {
      contentId,
      stage: ContentPipelineStage.Annotation,
    });
    if (existingRun?.status === ContentPipelineRunStatus.Completed) {
      return;
    }

    const content = await this.em.findOneOrFail(Content, contentId);
    if (content.status === ContentStatus.Pending) {
      content.status = ContentStatus.Annotating;
      await this.em.flush();
    }

    const parts = await this.em.find(
      ContentPart,
      { contentId },
      { orderBy: { blockIndex: 'asc' } },
    );

    const caches: AnnotationCaches = {
      wordDefinitionIdByKey: new Map(),
      phraseIdByText: new Map(),
    };

    for (const part of parts) {
      if (part.annotatedAt) {
        continue;
      }

      if (part.kind === ContentPartKind.Paragraph) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — shares caches with prior parts and the flush below must land before the next iteration starts.
        await this.annotateParagraphPart(part, caches);
      } else {
        await this.annotateListPart(part, caches);
      }

      part.annotatedAt = DateTime.now();
      await this.em.flush();
    }

    content.status = ContentStatus.Annotated;

    const run = existingRun ?? new ContentPipelineRun();
    run.contentId = contentId;
    run.stage = ContentPipelineStage.Annotation;
    run.status = ContentPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    await this.em.flush();
  }

  private async annotateParagraphPart(
    part: ContentPart,
    caches: AnnotationCaches,
  ): Promise<void> {
    const paragraph = part.body as Paragraph;
    const { text, offsets } = flattenParagraph(paragraph);

    if (!text.trim()) {
      return;
    }

    const annotations = await this.computeAnnotations(text, offsets);
    part.body = await this.applyAnnotationsToParagraph(
      paragraph,
      text,
      annotations,
      caches,
    );
  }

  private async annotateListPart(
    part: ContentPart,
    caches: AnnotationCaches,
  ): Promise<void> {
    const list = part.body as ListBlock;
    const items: ListItem[] = [];

    for (const item of list.items) {
      const { text, offsets } = flattenNodes(item.children);

      if (!text.trim()) {
        items.push(item);
        continue;
      }

      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each item's find-or-create must see the previous item's not-yet-flushed Word/Phrase via the cache.
      const annotations = await this.computeAnnotations(text, offsets);
      const spliced = await this.applyAnnotationsToListItem(
        item,
        text,
        annotations,
        caches,
      );
      items.push(spliced);
    }

    part.body = { ...list, items };
  }

  // The model never states a position (see annotation-prompt.ts) — it
  // copies the text back out verbatim with tags inserted inline, and
  // parseAnnotationTags recovers offsets deterministically via indexOf and
  // reports isComplete: false if the reconstructed text doesn't match
  // `text` exactly (a truncation, a word skipped anywhere — not just at the
  // end — or a malformed tag). On that signal, retry once on the SAME full
  // text (never a slice: with no offsets to trust in the first place,
  // there's nothing to "resume from") and merge both attempts. This is the
  // one bounded lever this pipeline needs — no chunking, no separate
  // verify-pass call, no offset-recovery heuristics.
  private async computeAnnotations(
    text: string,
    offsets: NodeOffset[],
  ): Promise<Annotation[]> {
    const first = await this.callAnnotationPrompt(text);
    let merged = first.annotations;
    let isComplete = first.isComplete;

    if (!isComplete) {
      const retry = await this.callAnnotationPrompt(text);
      merged = [...merged, ...retry.annotations];
      isComplete = retry.isComplete;
    }

    if (!isComplete) {
      this.logger.warn(
        { textLength: text.length },
        'annotation response still incomplete after retry — proceeding with the partial annotations found',
      );
    }

    const annotations = dropIncompleteAnnotations(
      dropSpansCrossingNodeBoundaries(
        offsets,
        resolveWordPhraseOverlaps(dedupeAnnotations(merged)),
      ),
    );

    validateAnnotations(text, annotations);
    return annotations;
  }

  private async callAnnotationPrompt(
    text: string,
  ): Promise<ParseAnnotationTagsResult> {
    const raw = await this.ai.complete({
      system: ANNOTATION_SYSTEM_PROMPT,
      userText: text,
    });
    return parseAnnotationTags(text, raw);
  }

  // Upserts the Word/WordDefinition or Phrase rows for `annotations` and
  // splices them into `paragraph`/`item`. Public so tooling that already has
  // a captured Annotation[] (e.g. a seed replaying a snapshot instead of
  // calling the AI) can reuse the exact same DB-writing logic as the live
  // pipeline. Re-validates `annotations` against `text` — cheap, and gives a
  // clear error if a fixture's source text ever drifts from its captured
  // annotations instead of silently mis-splicing.
  private async applyAnnotationsToParagraph(
    paragraph: Paragraph,
    text: string,
    annotations: Annotation[],
    caches: AnnotationCaches,
  ): Promise<Paragraph> {
    validateAnnotations(text, annotations);
    const inserts = await this.buildSpanInserts(annotations, caches);
    return spliceSpans(paragraph, inserts);
  }

  private async applyAnnotationsToListItem(
    item: ListItem,
    text: string,
    annotations: Annotation[],
    caches: AnnotationCaches,
  ): Promise<ListItem> {
    validateAnnotations(text, annotations);
    const inserts = await this.buildSpanInserts(annotations, caches);
    return spliceSpansIntoListItem(item, inserts);
  }

  // Resolves each annotation to a Word/WordDefinition or Phrase, find-or-
  // creating as needed. Correctness against concurrent jobs (a different
  // Content processed at the same time, same lemma/phrase) comes from the
  // atomic upserts in upsertWordId/upsertPhraseId/em.upsert below, not from
  // `caches` — that's scoped to one execute() call and exists purely to
  // avoid redundant round trips for repeat occurrences within this run.
  private async buildSpanInserts(
    annotations: Annotation[],
    caches: AnnotationCaches,
  ): Promise<SpanInsert[]> {
    const phraseIdByGroupId = new Map<string, string>();

    for (const annotation of annotations) {
      if (annotation.kind !== 'phrase') {
        continue;
      }

      const groupId = annotation.phraseGroupId as string;
      if (phraseIdByGroupId.has(groupId)) {
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

    for (const annotation of annotations) {
      if (annotation.kind === 'word') {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — must see the previous iteration's not-yet-flushed Word/WordDefinition via `cache`.
        const wordDefinitionId = await this.findOrCreateWordDefinitionId(
          annotation.lemma as string,
          annotation.pos as PartOfSpeech,
          caches.wordDefinitionIdByKey,
        );
        inserts.push({
          kind: 'word',
          start: annotation.start,
          end: annotation.end,
          wordDefinitionId,
          pos: annotation.pos as string,
        });
      } else {
        const groupId = annotation.phraseGroupId as string;
        inserts.push({
          kind: 'phrase',
          start: annotation.start,
          end: annotation.end,
          phraseId: phraseIdByGroupId.get(groupId) as string,
        });
      }
    }

    return inserts;
  }

  private async findOrCreateWordDefinitionId(
    lemma: string,
    pos: PartOfSpeech,
    cache: Map<string, string>,
  ): Promise<string> {
    const key = `${lemma.toLowerCase()} ${pos}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const wordId = await this.upsertWordId(lemma);

    // word_definitions has a real column-level unique constraint
    // (word_id, pos), so em.upsert() can target it directly: an atomic
    // insert-or-fetch, immune to the same concurrent-job race the
    // find-then-create version had. 'ignore' means an existing
    // definition's cefrLevel/definition/... are never overwritten by a
    // later occurrence of the same word elsewhere. `id` must be passed
    // explicitly: the entity's `id: string = uuidv7()` default is a
    // class-field initializer that only runs via `new WordDefinition()`,
    // not for a plain data object handed to em.upsert(). cefrLevel is left
    // unset here — it's filled in later by the word-definition enrichment
    // job (see WordDefinition.cefrLevel), not the annotation pass.
    const definition = await this.em.upsert(
      WordDefinition,
      { id: uuidv7(), wordId, pos },
      { onConflictFields: ['wordId', 'pos'], onConflictAction: 'ignore' },
    );

    cache.set(key, definition.id);
    return definition.id;
  }

  // Word.lemma's uniqueness is a case-insensitive *expression* index
  // (lower(lemma)) — em.upsert()'s onConflictFields only ever emits
  // `on conflict ("lemma")`, which can't target an expression index, so
  // this needs raw SQL (same style as
  // ChallengeService.incrementAttempts/SessionService.refresh). Two
  // concurrent annotate-content jobs racing to create the same lemma (e.g.
  // "the" appearing in two different Content rows processed in the same
  // worker batch — JobWorkerHost.work() runs a batch via Promise.all) now
  // resolve atomically at the DB level instead of both attempting an
  // insert and one throwing on the unique index. The no-op
  // `do update set lemma = words.lemma` (instead of `do nothing`) is what
  // lets one round trip return the existing row's id on conflict too —
  // `do nothing` returns zero rows on conflict and would need a second
  // query to fetch it.
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

    const phraseId = await this.upsertPhraseId(
      phraseText,
      (type as PhraseType | undefined) ?? null,
    );

    cache.set(key, phraseId);
    return phraseId;
  }

  // Same case-insensitive expression-index constraint as Word.lemma
  // (lower(phrase_text)) — see upsertWordId for why em.upsert() can't
  // target it and this is raw SQL instead. type is only ever written on
  // first creation (the no-op DO UPDATE leaves an existing phrase's
  // classification untouched), matching the previous find-then-create
  // semantics exactly, just atomically. cefr_level is left null here — it's
  // filled in later by the fill-phrase enrichment job (see Phrase.cefrLevel),
  // not the annotation pass.
  private async upsertPhraseId(
    phraseText: string,
    type: PhraseType | null,
  ): Promise<string> {
    const rows = await this.em.getConnection().execute<{ id: string }[]>(
      `INSERT INTO phrases (id, phrase_text, type, created_at, updated_at)
         VALUES (?, ?, ?, now(), now())
         ON CONFLICT (lower(phrase_text)) DO UPDATE SET phrase_text = phrases.phrase_text
         RETURNING id`,
      [uuidv7(), phraseText, type],
      'all',
      this.em.getTransactionContext(),
    );

    return (rows[0] as { id: string }).id;
  }
}
