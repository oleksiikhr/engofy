import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { cefrRank } from '../../domain/cefr-order.js';
import { collectSpanNodes } from '../../domain/collect-spans.js';
import type { SpanNode } from '../../domain/node-tree.types.js';
import { assembleDocFromParts } from '../../domain/post-parts.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarConstruction } from '../../entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../entities/grammar-usage-point.entity.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { GetPostDetailQuery } from './get-post-detail.query.js';
import type {
  GrammarAnnotationView,
  PhraseAnnotationView,
  PostDetailView,
  PostExerciseView,
  WordAnnotationView,
} from './post-detail-view.js';

// Backs `/posts/{slug}-{id}` (PLAN.md §4, §6): the reassembled node tree plus
// the lexicon/grammar entries the inline spans reference, and the post's
// exercises. Only published posts are visible (guests included, PLAN.md §2).
// The inline analysis comes from the node-tree spans, not the parallel spaCy
// `sentences` / `grammar_matches` layer (PLAN.md §12).
@QueryHandler(GetPostDetailQuery)
export class GetPostDetailHandler implements IQueryHandler<GetPostDetailQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({
    shortId,
  }: GetPostDetailQuery): Promise<PostDetailView | null> {
    const post = await this.em.findOne(Post, {
      shortId,
      status: PostStatus.Published,
    });
    if (!post) {
      return null;
    }

    const [parts, exercises] = await Promise.all([
      this.em.find(
        PostPart,
        { postId: post.id },
        { orderBy: { blockIndex: 'asc' } },
      ),
      this.em.find(
        Exercise,
        { postId: post.id },
        { orderBy: { createdAt: 'asc', id: 'asc' } },
      ),
    ]);

    const doc = assembleDocFromParts(parts);
    const spans = collectSpanNodes(doc.children);

    return {
      shortId: post.shortId,
      slug: post.slug ?? null,
      title: post.title ?? null,
      cefrLevel: post.cefrLevel ?? null,
      publishedAt: post.publishedAt.toISO() ?? post.publishedAt.toString(),
      sourceLink: post.source.link ?? null,
      doc,
      annotations: await this.resolveAnnotations(spans),
      exercises: exercises.map(toExerciseView),
    };
  }

  private async resolveAnnotations(spans: SpanNode[]) {
    const wordDefinitionIds = unique(
      spans.map((span) =>
        span.kind === 'word' ? span.wordDefinitionId : null,
      ),
    );
    const phraseIds = unique(
      spans.map((span) => (span.kind === 'phrase' ? span.phraseId : null)),
    );
    const grammarSlugs = unique(spans.map((span) => span.grammarConstruct));

    const [words, phrases, grammar] = await Promise.all([
      this.resolveWords(wordDefinitionIds),
      this.resolvePhrases(phraseIds),
      this.resolveGrammar(grammarSlugs),
    ]);

    return { words, phrases, grammar };
  }

  private async resolveWords(
    wordDefinitionIds: string[],
  ): Promise<Record<string, WordAnnotationView>> {
    if (wordDefinitionIds.length === 0) {
      return {};
    }
    const definitions = await this.em.find(WordDefinition, {
      id: { $in: wordDefinitionIds },
    });
    const words = await this.em.find(Word, {
      id: { $in: unique(definitions.map((d) => d.wordId)) },
    });
    const wordById = new Map(words.map((word) => [word.id, word]));

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
      };
    }
    return out;
  }

  private async resolvePhrases(
    phraseIds: string[],
  ): Promise<Record<string, PhraseAnnotationView>> {
    if (phraseIds.length === 0) {
      return {};
    }
    const phrases = await this.em.find(Phrase, { id: { $in: phraseIds } });
    const out: Record<string, PhraseAnnotationView> = {};
    for (const phrase of phrases) {
      out[phrase.id] = {
        phraseId: phrase.id,
        text: phrase.phraseText,
        type: phrase.type ?? null,
        definition: phrase.definition ?? null,
        example: phrase.exampleSentence ?? null,
        cefrLevel: phrase.cefrLevel ?? null,
      };
    }
    return out;
  }

  private async resolveGrammar(
    slugs: string[],
  ): Promise<Record<string, GrammarAnnotationView>> {
    if (slugs.length === 0) {
      return {};
    }
    const constructions = await this.em.find(GrammarConstruction, {
      slug: { $in: slugs },
    });
    const points = await this.em.find(GrammarUsagePoint, {
      constructionId: { $in: constructions.map((c) => c.id) },
    });
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
