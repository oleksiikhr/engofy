import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import {
  AI_CLIENT,
  type AiClient,
} from '../../../../core/ai/ai-client.port.js';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import {
  paintGrammarConstruct,
  stripGrammarConstructs,
} from '../../domain/apply-grammar-constructs.js';
import {
  buildGrammarCatalog,
  buildGrammarUserText,
  GRAMMAR_SYSTEM_PROMPT,
  type GrammarCatalogEntry,
  type GrammarCatalogUsagePoint,
  type ParsedGrammarResponse,
  parseGrammarResponse,
} from '../../domain/grammar-prompt.js';
import { spanToTokenRange } from '../../domain/grammar-span-tokens.js';
import type { Block, Node } from '../../domain/node-tree.types.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import type { PostAiGrammarEnrichmentJobData } from '../enrich-grammar/enrich-grammar.handler.js';
import type { PostAiExercisesJobData } from '../generate-exercises/generate-exercises.handler.js';
import { TagGrammarCommand } from './tag-grammar.command.js';

export interface PostAiGrammarJobData {
  postId: string;
}

// How long to wait before re-checking the annotation branch while the grammar
// stage is still gated on it (mirrors publish-post's D6 gate).
const ANNOTATION_GATE_RETRY_SECONDS = 30;

interface GrammarCatalog {
  systemPrompt: string;
  usagePointIdByEgpIndex: Map<number, string>;
  egpIndexesBySlug: Map<string, Set<number>>;
  slugByEgpIndex: Map<number, string>;
}

// One grammar span to paint onto a PostPart's node tree, already re-based into
// flattened-unit coordinates.
interface PaintSpan {
  unitIndex: number;
  start: number;
  end: number;
  slug: string;
}

// The construction slug get-post-detail.resolveGrammar keys on, taken from the
// authoritative usage-point catalogue rather than the model's raw slug text.
// Returns null for a span the grammar_matches pass already dropped (unknown
// slug / out-of-construction egpIndex) — no need to warn about it twice.
function resolvePaintSlug(
  span: { slug: string; egpIndex: number | null },
  catalog: GrammarCatalog,
): string | null {
  const validEgpIndexes = catalog.egpIndexesBySlug.get(span.slug);
  if (
    !validEgpIndexes ||
    span.egpIndex === null ||
    !validEgpIndexes.has(span.egpIndex)
  ) {
    return null;
  }
  return catalog.slugByEgpIndex.get(span.egpIndex) ?? null;
}

// ai_grammar stage (PLAN.md §5): one AI call tags every sentence against the
// closed catalogue of 90 constructions / 574 EGP usage points, using the
// same inline-⟦⟧-tag mechanism as the annotation stage (offsets recovered
// deterministically, never stated by the model). Each tagged span is mapped
// onto SentenceToken positions -> grammar_matches. Consumes the spaCy
// `sentences` / `sentence_tokens` from spacy_parse; in the DAG it is the
// stage after ai_complexity (AssessComplexityHandler enqueues it on
// completion). Idempotent via the stage-level PostPipelineRun row (§12); a
// partial re-run rebuilds all matches for the post's sentences.
@CommandHandler(TagGrammarCommand)
export class TagGrammarHandler implements ICommandHandler<TagGrammarCommand> {
  private readonly logger = new Logger(TagGrammarHandler.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: TagGrammarCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.AiGrammar,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    await this.em.findOneOrFail(Post, postId);

    // Gate on the parallel annotation branch (mirrors publish-post / D6). The
    // second phase below paints grammarConstruct onto post_parts.body, and
    // annotate-post writes the same rows off the other fan-out branch. Waiting
    // for annotation to be Completed makes tag-grammar the last writer of
    // part.body, so there is no race. In practice annotation finishes well
    // before ai_complexity -> ai_grammar, so this re-queue rarely fires.
    const annotationRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Annotation,
    });
    if (annotationRun?.status !== PostPipelineRunStatus.Completed) {
      this.outbox.send<PostAiGrammarJobData>(
        this.em,
        QueueName.PostAiGrammar,
        { postId },
        { singletonKey: postId, startAfter: ANNOTATION_GATE_RETRY_SECONDS },
      );
      this.logger.log({ postId }, 'ai_grammar gated on annotation branch');
      return;
    }

    const sentences = await this.em.find(
      Sentence,
      { postId },
      { orderBy: { postPartId: 'asc', unitIndex: 'asc', position: 'asc' } },
    );
    if (sentences.length === 0) {
      throw new Error(
        `ai_grammar needs spacy_parse output — no sentences for post ${postId}`,
      );
    }

    const catalog = await this.loadCatalog();
    const parsed = await this.callModel(catalog, sentences);

    const tokensBySentence = await this.loadTokens(sentences.map((s) => s.id));

    await this.em.nativeDelete(GrammarMatch, {
      sentenceId: { $in: sentences.map((s) => s.id) },
    });

    // The (sentence, usage point, token range) composite unique rejects an
    // exact duplicate at flush; dedupe the model's spans in memory first so a
    // repeated span is a silent no-op, not a failed job.
    const seen = new Set<string>();
    let matchCount = 0;
    for (const line of parsed.lines) {
      const sentence = sentences[line.index];
      const tokens = tokensBySentence.get(sentence.id) ?? [];
      for (const span of line.spans) {
        if (this.persistMatch(sentence.id, span, tokens, catalog, seen)) {
          matchCount += 1;
        }
      }
    }

    this.logger.log(
      { postId, sentences: sentences.length, matches: matchCount },
      'ai_grammar tagged',
    );

    // Second phase: paint the same spans onto the reader's node tree (F3).
    await this.paintGrammarConstructs(postId, parsed, sentences, catalog);

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.AiGrammar;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);

    // Next stage in the pipeline chain (PLAN.md §5), plus the grammar
    // enrichment branch — it needs the grammar_matches written above.
    this.outbox.send<PostAiGrammarEnrichmentJobData>(
      this.em,
      QueueName.PostAiGrammarEnrichment,
      { postId },
      { singletonKey: postId },
    );
    this.outbox.send<PostAiExercisesJobData>(
      this.em,
      QueueName.PostAiExercises,
      { postId },
      { singletonKey: postId },
    );
  }

  private async loadCatalog(): Promise<GrammarCatalog> {
    const constructions = await this.em.find(
      GrammarConstruction,
      {},
      { orderBy: { sortOrder: 'asc' } },
    );
    const usagePoints = await this.em.find(
      GrammarUsagePoint,
      { egpIndex: { $ne: null } },
      { orderBy: { egpIndex: 'asc' } },
    );

    const slugById = new Map(constructions.map((c) => [c.id, c.slug]));
    const usagePointIdByEgpIndex = new Map<number, string>();
    const egpIndexesBySlug = new Map<string, Set<number>>();
    const slugByEgpIndex = new Map<number, string>();
    const pointsBySlug = new Map<string, GrammarCatalogUsagePoint[]>();

    for (const up of usagePoints) {
      const slug = slugById.get(up.constructionId);
      if (!slug || up.egpIndex === null || up.egpIndex === undefined) {
        continue;
      }
      usagePointIdByEgpIndex.set(up.egpIndex, up.id);
      slugByEgpIndex.set(up.egpIndex, slug);

      let egpIndexes = egpIndexesBySlug.get(slug);
      if (!egpIndexes) {
        egpIndexes = new Set();
        egpIndexesBySlug.set(slug, egpIndexes);
      }
      egpIndexes.add(up.egpIndex);

      let points = pointsBySlug.get(slug);
      if (!points) {
        points = [];
        pointsBySlug.set(slug, points);
      }
      points.push({
        egpIndex: up.egpIndex,
        cefr: up.cefrLevel,
        guideword: up.guideword,
        canDoStatement: up.canDoStatement,
      });
    }

    const entries: GrammarCatalogEntry[] = constructions
      .filter((c) => pointsBySlug.has(c.slug))
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        usagePoints: pointsBySlug.get(c.slug) ?? [],
      }));

    return {
      systemPrompt: GRAMMAR_SYSTEM_PROMPT + buildGrammarCatalog(entries),
      usagePointIdByEgpIndex,
      egpIndexesBySlug,
      slugByEgpIndex,
    };
  }

  private async loadTokens(
    sentenceIds: string[],
  ): Promise<Map<string, SentenceToken[]>> {
    const tokens = await this.em.find(
      SentenceToken,
      { sentenceId: { $in: sentenceIds } },
      { orderBy: { position: 'asc' } },
    );
    const bySentence = new Map<string, SentenceToken[]>();
    for (const token of tokens) {
      let list = bySentence.get(token.sentenceId);
      if (!list) {
        list = [];
        bySentence.set(token.sentenceId, list);
      }
      list.push(token);
    }
    return bySentence;
  }

  // One AI call, with one retry on an incomplete parse (same contract as the
  // annotation stage). Whichever attempt reconstructs every sentence wins;
  // if neither does, the later attempt is used and the gap is logged.
  private async callModel(
    catalog: GrammarCatalog,
    sentences: Sentence[],
  ): Promise<ParsedGrammarResponse> {
    const sentenceTexts = sentences.map((s) => s.rawText);
    const userText = buildGrammarUserText(sentenceTexts);

    const first = parseGrammarResponse(
      sentenceTexts,
      await this.ai.complete({ system: catalog.systemPrompt, userText }),
    );
    if (first.isComplete) {
      return first;
    }

    const second = parseGrammarResponse(
      sentenceTexts,
      await this.ai.complete({ system: catalog.systemPrompt, userText }),
    );
    if (!second.isComplete) {
      this.logger.warn(
        { sentences: sentences.length },
        'ai_grammar response still incomplete after retry — proceeding with partial spans',
      );
    }
    return second;
  }

  private persistMatch(
    sentenceId: string,
    span: {
      slug: string;
      egpIndex: number | null;
      charStart: number;
      charEnd: number;
      form: string;
    },
    tokens: SentenceToken[],
    catalog: GrammarCatalog,
    seen: Set<string>,
  ): boolean {
    const validEgpIndexes = catalog.egpIndexesBySlug.get(span.slug);
    if (!validEgpIndexes) {
      this.logger.warn(
        { slug: span.slug },
        'ai_grammar: unknown construction slug — dropped',
      );
      return false;
    }
    if (span.egpIndex === null || !validEgpIndexes.has(span.egpIndex)) {
      this.logger.warn(
        { slug: span.slug, egpIndex: span.egpIndex },
        'ai_grammar: missing or out-of-construction usage point — dropped',
      );
      return false;
    }

    const usagePointId = catalog.usagePointIdByEgpIndex.get(span.egpIndex);
    if (!usagePointId) {
      return false;
    }

    const range = spanToTokenRange(span, tokens);
    if (!range) {
      this.logger.warn(
        { slug: span.slug, form: span.form },
        'ai_grammar: span covered no token — dropped',
      );
      return false;
    }

    const key = `${sentenceId}|${usagePointId}|${range.tokenStart}|${range.tokenEnd}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    const grammarMatch = new GrammarMatch();
    grammarMatch.sentenceId = sentenceId;
    grammarMatch.grammarUsagePointId = usagePointId;
    grammarMatch.tokenStart = range.tokenStart;
    grammarMatch.tokenEnd = range.tokenEnd;
    this.em.persist(grammarMatch);
    return true;
  }

  // Second phase (F3): paint each parsed grammar span's construction slug onto
  // the post_parts node tree, so get-post-detail can resolve
  // `annotations.grammar` from `span.grammarConstruct` (the read path never
  // touches `grammar_matches`). Gated on the annotation branch (see execute),
  // so tag-grammar is the last writer of `part.body` — no race with the
  // parallel annotate-post. Flush-per-PostPart: the 3rd sanctioned exception
  // to "a handler doesn't flush" (cqrs.md), same rationale as annotate-post.
  private async paintGrammarConstructs(
    postId: string,
    parsed: ParsedGrammarResponse,
    sentences: Sentence[],
    catalog: GrammarCatalog,
  ): Promise<void> {
    const spansByPart = new Map<string, PaintSpan[]>();
    for (const line of parsed.lines) {
      const sentence = sentences[line.index];
      for (const span of line.spans) {
        const slug = resolvePaintSlug(span, catalog);
        if (!slug) {
          continue;
        }
        const list = spansByPart.get(sentence.postPartId) ?? [];
        // `rawText` char offsets are relative to the sentence; the sentence is
        // placed at `charStart` inside the flattened unit — the exact system
        // flattenParagraph / spliceSpans use.
        list.push({
          unitIndex: sentence.unitIndex,
          start: sentence.charStart + span.charStart,
          end: sentence.charStart + span.charEnd,
          slug,
        });
        spansByPart.set(sentence.postPartId, list);
      }
    }

    const parts = await this.em.find(
      PostPart,
      { postId },
      { orderBy: { blockIndex: 'asc' } },
    );
    for (const part of parts) {
      part.body = this.paintPartBody(part, spansByPart.get(part.id) ?? []);
      // biome-ignore lint/performance/noAwaitInLoops: flush-per-PostPart (P4 / cqrs.md) so a crash mid-post keeps finished parts.
      await this.em.flush();
    }
  }

  private paintPartBody(part: PostPart, spans: PaintSpan[]): Block {
    // strip -> repaint from the current model output every run (P7): a partial
    // stage retry never stacks the previous run's paint.
    const stripped = stripGrammarConstructs(part.body);

    if (stripped.type === 'list') {
      return {
        ...stripped,
        items: stripped.items.map((item, unitIndex) => ({
          children: this.paintUnit(
            part,
            item.children,
            spans.filter((span) => span.unitIndex === unitIndex),
          ),
        })),
      };
    }

    return {
      ...stripped,
      children: this.paintUnit(
        part,
        stripped.children,
        spans.filter((span) => span.unitIndex === 0),
      ),
    };
  }

  private paintUnit(
    part: PostPart,
    children: Node[],
    spans: PaintSpan[],
  ): Node[] {
    // Longest first: a nested shorter construction painted afterwards re-wraps
    // only the shared slice, so the more specific slug wins on shared tokens
    // (V1 limit — one slug per span).
    const ordered = [...spans].sort(
      (a, b) => b.end - b.start - (a.end - a.start),
    );

    let nodes = children;
    for (const span of ordered) {
      const painted = paintGrammarConstruct(
        nodes,
        { start: span.start, end: span.end },
        span.slug,
      );
      if (painted) {
        nodes = painted;
        continue;
      }
      this.logger.warn(
        {
          postId: part.postId,
          partId: part.id,
          unitIndex: span.unitIndex,
          slug: span.slug,
        },
        'ai_grammar: grammar span partially covers a word/phrase span or a link — not painted',
      );
    }
    return nodes;
  }
}
