import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import { cefrRank } from '../../domain/cefr-order.js';
import { collectSpanNodes } from '../../domain/collect-spans.js';
import { pickGrammarTranslation } from '../../domain/content-translations.js';
import { loadIrregularVerbsByLemma } from '../../domain/irregular-verb.js';
import { locateGrammarMatch } from '../../domain/locate-grammar-match.js';
import { locateSentenceTokens } from '../../domain/locate-sentence-tokens.js';
import { parseDoc } from '../../domain/node-tree.parser.js';
import type { SpanNode } from '../../domain/node-tree.types.js';
import { assembleDocFromParts } from '../../domain/post-parts.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import type { ContentLanguage } from '../../enums/content-language.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import {
  LexiconViewService,
  type Viewer,
} from '../../services/lexicon-view.service.js';
import { GetPostDetailQuery } from './get-post-detail.query.js';
import type {
  GrammarAnnotationView,
  GrammarMatchView,
  PhraseAnnotationView,
  PostDetailView,
  PostExerciseView,
  TokenView,
  WordAnnotationView,
} from './post-detail-view.js';

interface ResolvedAnnotations {
  words: Record<string, WordAnnotationView>;
  phrases: Record<string, PhraseAnnotationView>;
  grammar: Record<string, GrammarAnnotationView>;
  grammarMatches: GrammarMatchView[];
  tokens: TokenView[];
}

// Backs `/posts/{slug}-{id}` (PLAN.md §4, §6): the reassembled node tree plus
// the lexicon/grammar entries the inline spans reference, and the post's
// exercises. Only published posts are visible (guests included, PLAN.md §2).
// Word/phrase analysis comes from the node-tree spans, not the parallel spaCy
// `sentences` layer (PLAN.md §12); only `grammar_matches` is read from that
// layer, resolved to char ranges in the node tree's text coordinates.
@QueryHandler(GetPostDetailQuery)
export class GetPostDetailHandler implements IQueryHandler<GetPostDetailQuery> {
  constructor(
    private readonly em: EntityManager,
    private readonly lexicon: LexiconViewService,
  ) {}

  async execute({
    shortId,
    userId,
    lang,
  }: GetPostDetailQuery): Promise<PostDetailView | null> {
    const post = await this.em.findOne(
      Post,
      { shortId, status: PostStatus.Published },
      { disableIdentityMap: true },
    );
    if (!post) {
      return null;
    }

    const [parts, exercises, exerciseSentences, readCount] = await Promise.all([
      this.em.find(
        PostPart,
        { postId: post.id },
        { orderBy: { blockIndex: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(
        Exercise,
        { postId: post.id },
        { orderBy: { createdAt: 'asc', id: 'asc' }, disableIdentityMap: true },
      ),
      this.em.find(
        Sentence,
        { postId: post.id },
        { fields: ['id', 'postPartId'], disableIdentityMap: true },
      ),
      userId ? this.em.count(PostRead, { userId, postId: post.id }) : 0,
    ]);
    const blockIndexBySentence = new Map<string, number>();
    const blockIndexByPart = new Map(
      parts.map((part) => [part.id, part.blockIndex]),
    );
    for (const sentence of exerciseSentences) {
      const blockIndex = blockIndexByPart.get(sentence.postPartId);
      if (blockIndex !== undefined) {
        blockIndexBySentence.set(sentence.id, blockIndex);
      }
    }

    // Reassemble the per-part fragments into a Doc and re-validate the whole
    // tree at read time (PLAN.md §6, D12) — `PostPartBodyType` can't run
    // `parseDoc` on a bare fragment, so this is where a converter/splice bug
    // that wrote a malformed node surfaces (InvalidNodeTreeError).
    const doc = parseDoc(assembleDocFromParts(parts));
    const spans = collectSpanNodes(doc.children);
    const annotations = await this.resolveAnnotations(
      spans,
      userId,
      lang,
      post.id,
      parts,
    );

    return {
      shortId: post.shortId,
      slug: post.slug ?? null,
      title: post.title ?? null,
      metaDescription: post.metaDescription ?? null,
      cefrLevel: post.cefrLevel ?? null,
      publishedAt: post.publishedAt.toISO() ?? post.publishedAt.toString(),
      attributionText: post.source.attributionText,
      sourceType: post.source.type,
      sourceLink: post.source.link ?? null,
      isRead: readCount > 0,
      doc,
      annotations,
      exercises: exercises.map((exercise) =>
        toExerciseView(exercise, blockIndexBySentence),
      ),
    };
  }

  private async resolveAnnotations(
    spans: SpanNode[],
    userId: string | null,
    lang: ContentLanguage,
    postId: string,
    parts: PostPart[],
  ): Promise<ResolvedAnnotations> {
    const wordDefinitionIds = unique(
      spans.map((span) =>
        span.kind === 'word' ? span.wordDefinitionId : null,
      ),
    );
    const phraseIds = unique(
      spans.map((span) => (span.kind === 'phrase' ? span.phraseId : null)),
    );
    const grammarSlugs = unique(spans.map((span) => span.grammarConstruct));

    // A guest has no CEFR level, cards or dispositions: every word/phrase is
    // New, no DB join.
    const userCefrLevel = userId
      ? (
          await this.em.findOneOrFail(
            User,
            { id: userId },
            { disableIdentityMap: true },
          )
        ).cefrLevel
      : null;
    const viewer = userId && userCefrLevel ? { userId, userCefrLevel } : null;

    const sentences = await this.em.find(
      Sentence,
      { postId },
      { disableIdentityMap: true },
    );
    const [words, phrases, grammarMatches, tokens] = await Promise.all([
      this.lexicon.resolveWords(wordDefinitionIds, viewer, lang),
      this.lexicon.resolvePhrases(phraseIds, viewer, lang),
      this.resolveGrammarMatches(sentences, parts, viewer),
      this.resolveTokens(sentences, parts),
    ]);
    const grammar = await this.resolveGrammar(
      grammarSlugs,
      unique(grammarMatches.map((match) => match.grammarUsagePointId)),
      lang,
    );

    return { words, phrases, grammar, grammarMatches, tokens };
  }

  // Placed grammar usage points for the reader's spans: each `grammar_matches`
  // row (sentence-relative token range) is mapped to a char range in its
  // block's unit text. A row that can't be placed (stale sentence text, no
  // covered token) is dropped, not painted on the wrong text.
  private async resolveGrammarMatches(
    sentences: Sentence[],
    parts: PostPart[],
    viewer: Viewer | null,
  ): Promise<GrammarMatchView[]> {
    if (sentences.length === 0) {
      return [];
    }
    const matches = await this.em.find(
      GrammarMatch,
      { sentenceId: { $in: sentences.map((s) => s.id) } },
      { disableIdentityMap: true },
    );
    if (matches.length === 0) {
      return [];
    }

    const matchedSentenceIds = unique(matches.map((m) => m.sentenceId));
    const [tokens, points] = await Promise.all([
      this.em.find(
        SentenceToken,
        { sentenceId: { $in: matchedSentenceIds } },
        { disableIdentityMap: true },
      ),
      this.em.find(
        GrammarUsagePoint,
        { id: { $in: unique(matches.map((m) => m.grammarUsagePointId)) } },
        { disableIdentityMap: true },
      ),
    ]);
    const states = await this.lexicon.resolveStates(
      viewer,
      'grammarUsagePointId',
      points.map((p) => ({ id: p.id, cefrLevel: p.cefrLevel })),
    );

    const sentenceById = new Map(sentences.map((s) => [s.id, s]));
    const tokensBySentence = new Map<string, SentenceToken[]>();
    for (const token of tokens) {
      const list = tokensBySentence.get(token.sentenceId) ?? [];
      list.push(token);
      tokensBySentence.set(token.sentenceId, list);
    }
    // `parts` is sorted by blockIndex — its position is the Doc.children index.
    const blockIndexByPartId = new Map(parts.map((p, i) => [p.id, i]));
    const partById = new Map(parts.map((p) => [p.id, p]));
    const knownPointIds = new Set(points.map((p) => p.id));

    const out: GrammarMatchView[] = [];
    for (const match of matches) {
      const sentence = sentenceById.get(match.sentenceId);
      const part = sentence && partById.get(sentence.postPartId);
      const blockIndex =
        sentence && blockIndexByPartId.get(sentence.postPartId);
      if (
        !sentence ||
        !part ||
        blockIndex === undefined ||
        !knownPointIds.has(match.grammarUsagePointId)
      ) {
        continue;
      }
      const located = locateGrammarMatch({
        block: part.body,
        sentence,
        tokens: tokensBySentence.get(sentence.id) ?? [],
        match,
      });
      if (!located) {
        continue;
      }
      out.push({
        blockIndex,
        ...located,
        grammarUsagePointId: match.grammarUsagePointId,
        state: states.get(match.grammarUsagePointId) ?? EffectiveState.New,
      });
    }

    return out.sort(
      (a, b) =>
        a.blockIndex - b.blockIndex ||
        (a.itemIndex ?? 0) - (b.itemIndex ?? 0) ||
        a.charStart - b.charStart ||
        a.charEnd - b.charEnd ||
        a.grammarUsagePointId.localeCompare(b.grammarUsagePointId),
    );
  }

  // The reader's per-token analysis (POS, tense, irregular verbs): each
  // spaCy token of a sentence is mapped to a char range in its block's unit
  // text. A sentence whose text no longer matches the tree is skipped whole.
  private async resolveTokens(
    sentences: Sentence[],
    parts: PostPart[],
  ): Promise<TokenView[]> {
    if (sentences.length === 0) {
      return [];
    }
    const [tokens, irregularByLemma] = await Promise.all([
      this.em.find(
        SentenceToken,
        { sentenceId: { $in: sentences.map((s) => s.id) } },
        { orderBy: { position: 'asc' }, disableIdentityMap: true },
      ),
      loadIrregularVerbsByLemma(),
    ]);
    const tokensBySentence = new Map<string, SentenceToken[]>();
    for (const token of tokens) {
      const list = tokensBySentence.get(token.sentenceId) ?? [];
      list.push(token);
      tokensBySentence.set(token.sentenceId, list);
    }
    const partIndexById = new Map(parts.map((p, i) => [p.id, i]));

    const out: TokenView[] = [];
    for (const sentence of sentences) {
      const blockIndex = partIndexById.get(sentence.postPartId);
      const part = parts[blockIndex ?? -1];
      if (blockIndex === undefined || !part) {
        continue;
      }
      for (const token of locateSentenceTokens({
        block: part.body,
        sentence,
        tokens: tokensBySentence.get(sentence.id) ?? [],
        irregularByLemma,
      })) {
        out.push({ blockIndex, ...token });
      }
    }
    return out.sort(
      (a, b) =>
        a.blockIndex - b.blockIndex ||
        (a.itemIndex ?? 0) - (b.itemIndex ?? 0) ||
        a.charStart - b.charStart,
    );
  }

  // Constructions named by a span's `grammarConstruct` slug, plus the ones
  // owning a matched usage point — so every label the reader paints has its
  // construction entry to show.
  private async resolveGrammar(
    slugs: string[],
    matchedPointIds: string[],
    lang: ContentLanguage,
  ): Promise<Record<string, GrammarAnnotationView>> {
    if (slugs.length === 0 && matchedPointIds.length === 0) {
      return {};
    }
    const matchedPoints =
      matchedPointIds.length > 0
        ? await this.em.find(
            GrammarUsagePoint,
            { id: { $in: matchedPointIds } },
            { disableIdentityMap: true },
          )
        : [];
    const constructions = await this.em.find(
      GrammarConstruction,
      {
        $or: [
          { slug: { $in: slugs } },
          { id: { $in: unique(matchedPoints.map((p) => p.constructionId)) } },
        ],
      },
      { disableIdentityMap: true },
    );
    const points = await this.em.find(
      GrammarUsagePoint,
      { constructionId: { $in: constructions.map((c) => c.id) } },
      { disableIdentityMap: true },
    );
    const pointsByConstruction = new Map<string, GrammarUsagePoint[]>();
    for (const point of points) {
      const list = pointsByConstruction.get(point.constructionId) ?? [];
      list.push(point);
      pointsByConstruction.set(point.constructionId, list);
    }

    const out: Record<string, GrammarAnnotationView> = {};
    for (const construction of constructions) {
      const constructionPoints = (
        pointsByConstruction.get(construction.id) ?? []
      ).sort((a, b) => cefrRank(a.cefrLevel) - cefrRank(b.cefrLevel));
      out[construction.slug] = {
        slug: construction.slug,
        name: construction.name,
        cefrLevel: constructionPoints[0]?.cefrLevel ?? null,
        usagePoints: constructionPoints.map((point) => ({
          grammarUsagePointId: point.id,
          egpIndex: point.egpIndex ?? null,
          cefrLevel: point.cefrLevel,
          guideword: point.guideword,
          canDoStatement: point.canDoStatement,
          explanation: point.learnerExplanation ?? null,
          ...pickGrammarTranslation(point.translations, lang),
          examples: point.learnerExamples ?? [],
        })),
      };
    }
    return out;
  }
}

function toExerciseView(
  exercise: Exercise,
  blockIndexBySentence: Map<string, number>,
): PostExerciseView {
  const { sentenceId } = exercise.payload;
  const blockIndex =
    typeof sentenceId === 'string'
      ? blockIndexBySentence.get(sentenceId)
      : undefined;
  return {
    id: exercise.id,
    type: exercise.type,
    source: exercise.source,
    payload: exercise.payload,
    ...(blockIndex === undefined ? {} : { blockIndex }),
  };
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
