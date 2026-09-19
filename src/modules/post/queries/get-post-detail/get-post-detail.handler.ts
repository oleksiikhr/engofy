import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../../auth/entities/user.entity.js';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../../learning/entities/learning-disposition.entity.js';
import { cefrRank } from '../../domain/cefr-order.js';
import { collectSpanNodes } from '../../domain/collect-spans.js';
import { locateGrammarMatch } from '../../domain/locate-grammar-match.js';
import { parseDoc } from '../../domain/node-tree.parser.js';
import type { SpanNode } from '../../domain/node-tree.types.js';
import { assembleDocFromParts } from '../../domain/post-parts.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { GetPostDetailQuery } from './get-post-detail.query.js';
import type {
  GrammarAnnotationView,
  GrammarMatchView,
  PhraseAnnotationView,
  PostDetailView,
  PostExerciseView,
  WordAnnotationView,
} from './post-detail-view.js';

interface ResolvedAnnotations {
  words: Record<string, WordAnnotationView>;
  phrases: Record<string, PhraseAnnotationView>;
  grammar: Record<string, GrammarAnnotationView>;
  grammarMatches: GrammarMatchView[];
}

interface Viewer {
  userId: string;
  userCefrLevel: CefrLevel;
}

// Backs `/posts/{slug}-{id}` (PLAN.md §4, §6): the reassembled node tree plus
// the lexicon/grammar entries the inline spans reference, and the post's
// exercises. Only published posts are visible (guests included, PLAN.md §2).
// Word/phrase analysis comes from the node-tree spans, not the parallel spaCy
// `sentences` layer (PLAN.md §12); only `grammar_matches` is read from that
// layer, resolved to char ranges in the node tree's text coordinates.
@QueryHandler(GetPostDetailQuery)
export class GetPostDetailHandler implements IQueryHandler<GetPostDetailQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({
    shortId,
    userId,
  }: GetPostDetailQuery): Promise<PostDetailView | null> {
    const post = await this.em.findOne(
      Post,
      { shortId, status: PostStatus.Published },
      { disableIdentityMap: true },
    );
    if (!post) {
      return null;
    }

    const [parts, exercises] = await Promise.all([
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
    ]);

    // Reassemble the per-part fragments into a Doc and re-validate the whole
    // tree at read time (PLAN.md §6, D12) — `PostPartBodyType` can't run
    // `parseDoc` on a bare fragment, so this is where a converter/splice bug
    // that wrote a malformed node surfaces (InvalidNodeTreeError).
    const doc = parseDoc(assembleDocFromParts(parts));
    const spans = collectSpanNodes(doc.children);
    const annotations = await this.resolveAnnotations(
      spans,
      userId,
      post.id,
      parts,
    );

    return {
      shortId: post.shortId,
      slug: post.slug ?? null,
      title: post.title ?? null,
      cefrLevel: post.cefrLevel ?? null,
      publishedAt: post.publishedAt.toISO() ?? post.publishedAt.toString(),
      attributionText: post.source.attributionText,
      sourceType: post.source.type,
      sourceLink: post.source.link ?? null,
      doc,
      annotations,
      exercises: exercises.map(toExerciseView),
    };
  }

  private async resolveAnnotations(
    spans: SpanNode[],
    userId: string | null,
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

    const [words, phrases, grammar, grammarMatches] = await Promise.all([
      this.resolveWords(wordDefinitionIds, viewer),
      this.resolvePhrases(phraseIds, viewer),
      this.resolveGrammar(grammarSlugs),
      this.resolveGrammarMatches(postId, parts, viewer),
    ]);

    return { words, phrases, grammar, grammarMatches };
  }

  private async resolveWords(
    wordDefinitionIds: string[],
    viewer: Viewer | null,
  ): Promise<Record<string, WordAnnotationView>> {
    if (wordDefinitionIds.length === 0) {
      return {};
    }
    const definitions = await this.em.find(
      WordDefinition,
      { id: { $in: wordDefinitionIds } },
      { disableIdentityMap: true },
    );
    const words = await this.em.find(
      Word,
      { id: { $in: unique(definitions.map((d) => d.wordId)) } },
      { disableIdentityMap: true },
    );
    const wordById = new Map(words.map((word) => [word.id, word]));
    const states = await this.resolveStates(
      viewer,
      'wordDefinitionId',
      definitions.map((d) => ({ id: d.id, cefrLevel: d.cefrLevel ?? null })),
    );

    const out: Record<string, WordAnnotationView> = {};
    for (const definition of definitions) {
      const word = wordById.get(definition.wordId);
      out[definition.id] = {
        wordDefinitionId: definition.id,
        wordId: definition.wordId,
        lemma: word?.lemma ?? '',
        pos: definition.pos,
        definition: definition.definition ?? null,
        phonetic: definition.phonetic ?? null,
        example: definition.exampleSentence ?? null,
        cefrLevel: definition.cefrLevel ?? null,
        frequencyRank: word?.frequencyRank ?? null,
        state: states.get(definition.id) ?? EffectiveState.New,
      };
    }
    return out;
  }

  private async resolvePhrases(
    phraseIds: string[],
    viewer: Viewer | null,
  ): Promise<Record<string, PhraseAnnotationView>> {
    if (phraseIds.length === 0) {
      return {};
    }
    const phrases = await this.em.find(
      Phrase,
      { id: { $in: phraseIds } },
      { disableIdentityMap: true },
    );
    const states = await this.resolveStates(
      viewer,
      'phraseId',
      phrases.map((p) => ({ id: p.id, cefrLevel: p.cefrLevel ?? null })),
    );

    const out: Record<string, PhraseAnnotationView> = {};
    for (const phrase of phrases) {
      out[phrase.id] = {
        phraseId: phrase.id,
        text: phrase.phraseText,
        type: phrase.type ?? null,
        definition: phrase.definition ?? null,
        example: phrase.exampleSentence ?? null,
        cefrLevel: phrase.cefrLevel ?? null,
        state: states.get(phrase.id) ?? EffectiveState.New,
      };
    }
    return out;
  }

  // Effective state per target id for a logged-in viewer (active card ->
  // disposition -> CEFR default -> New). An empty map means "all New".
  private async resolveStates(
    viewer: Viewer | null,
    targetKey: 'wordDefinitionId' | 'phraseId' | 'grammarUsagePointId',
    targets: { id: string; cefrLevel: CefrLevel | null }[],
  ): Promise<Map<string, EffectiveState>> {
    const states = new Map<string, EffectiveState>();
    if (!viewer || targets.length === 0) {
      return states;
    }

    const ids = targets.map((t) => t.id);
    const [cards, dispositions] = await Promise.all([
      this.em.find(
        LearningCard,
        { userId: viewer.userId, [targetKey]: { $in: ids }, archivedAt: null },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId: viewer.userId, [targetKey]: { $in: ids } },
        { disableIdentityMap: true },
      ),
    ]);
    const cardById = new Map(
      cards.map((card) => [card[targetKey] as string, card]),
    );
    const dispositionById = new Map(
      dispositions.map((d) => [d[targetKey] as string, d.disposition]),
    );

    for (const target of targets) {
      const card = cardById.get(target.id);
      states.set(
        target.id,
        resolveEffectiveState({
          card: card
            ? { state: card.state, scheduledDays: card.scheduledDays }
            : null,
          disposition: dispositionById.get(target.id) ?? null,
          targetCefrLevel: target.cefrLevel,
          userCefrLevel: viewer.userCefrLevel,
        }),
      );
    }
    return states;
  }

  // Placed grammar usage points for the reader's spans: each `grammar_matches`
  // row (sentence-relative token range) is mapped to a char range in its
  // block's unit text. A row that can't be placed (stale sentence text, no
  // covered token) is dropped, not painted on the wrong text.
  private async resolveGrammarMatches(
    postId: string,
    parts: PostPart[],
    viewer: Viewer | null,
  ): Promise<GrammarMatchView[]> {
    const sentences = await this.em.find(
      Sentence,
      { postId },
      { disableIdentityMap: true },
    );
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
    const states = await this.resolveStates(
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

  private async resolveGrammar(
    slugs: string[],
  ): Promise<Record<string, GrammarAnnotationView>> {
    if (slugs.length === 0) {
      return {};
    }
    const constructions = await this.em.find(
      GrammarConstruction,
      { slug: { $in: slugs } },
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
          cefrLevel: point.cefrLevel,
          guideword: point.guideword,
          canDoStatement: point.canDoStatement,
          exampleText: point.exampleText ?? null,
        })),
      };
    }
    return out;
  }
}

function toExerciseView(exercise: Exercise): PostExerciseView {
  return {
    id: exercise.id,
    type: exercise.type,
    source: exercise.source,
    payload: exercise.payload,
  };
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
