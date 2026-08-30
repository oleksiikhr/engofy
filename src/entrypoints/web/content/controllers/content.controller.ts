import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../core/decorators/public.decorator.js';
import { toOffsetPage } from '../../../../core/http/dto/offset-page.js';
import { PostService } from '../../../../modules/post/post.service.js';
import type {
  FeedItemView,
  FeedView,
} from '../../../../modules/post/queries/get-feed/feed-view.js';
import type { GrammarConstructionView } from '../../../../modules/post/queries/get-grammar-construction/grammar-construction-view.js';
import type { GrammarReferenceView } from '../../../../modules/post/queries/get-grammar-reference/grammar-reference-view.js';
import type { PostDetailView } from '../../../../modules/post/queries/get-post-detail/post-detail-view.js';
import { parseSlugId } from '../../../../modules/post/queries/parse-slug-id.js';
import { FeedQueryDto } from '../dto/feed-query.dto.js';
import { FeedItemDto, FeedResponseDto } from '../dto/feed-response.dto.js';
import { GrammarConstructionResponseDto } from '../dto/grammar-construction-response.dto.js';
import { GrammarReferenceQueryDto } from '../dto/grammar-reference-query.dto.js';
import { GrammarReferenceResponseDto } from '../dto/grammar-reference-response.dto.js';
import {
  PostAnnotationsDto,
  PostDetailResponseDto,
} from '../dto/post-detail-response.dto.js';

// Guest-readable content surface (PLAN.md §2, §4): the post feed, a single
// post with its inline analysis, and the grammar reference. Served under
// `/api/*`. Each endpoint maps its module view onto a web DTO explicitly (no
// structural passthrough) so the HTTP contract stays decoupled from the
// module's internal query shapes.
@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly post: PostService) {}

  // The `/` feed: published posts, newest first, offset-paginated.
  @Public()
  @Get('feed')
  async feed(@Query() query: FeedQueryDto): Promise<FeedResponseDto> {
    const view = await this.post.getFeed(query.limit, query.offset);
    return toFeedResponse(view);
  }

  // One post for `/posts/{slug}-{id}`: node tree + resolved annotations +
  // exercises.
  @Public()
  @Get('posts/:slugId')
  async postDetail(
    @Param('slugId') slugId: string,
  ): Promise<PostDetailResponseDto> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    const view = await this.post.getPostDetail(shortId);
    if (!view) {
      throw new NotFoundException('Post not found');
    }
    return toPostDetailResponse(view);
  }

  // The `/grammar` reference index: 19 categories → constructions.
  @Public()
  @Get('grammar')
  async grammar(
    @Query() query: GrammarReferenceQueryDto,
  ): Promise<GrammarReferenceResponseDto> {
    const view = await this.post.getGrammarReference(query.cefr ?? null);
    return toGrammarReferenceResponse(view);
  }

  // One construction for `/grammar/{slug}`: cheat sheet + usage points.
  @Public()
  @Get('grammar/:slug')
  async grammarConstruction(
    @Param('slug') slug: string,
  ): Promise<GrammarConstructionResponseDto> {
    const view = await this.post.getGrammarConstruction(slug);
    if (!view) {
      throw new NotFoundException('Grammar construction not found');
    }
    return toGrammarConstructionResponse(view);
  }
}

function toFeedItemDto(item: FeedItemView): FeedItemDto {
  return {
    shortId: item.shortId,
    slug: item.slug,
    title: item.title,
    cefrLevel: item.cefrLevel,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt,
    attributionText: item.attributionText,
    sourceType: item.sourceType,
    sourceLink: item.sourceLink,
  };
}

function toFeedResponse(view: FeedView): FeedResponseDto {
  return toOffsetPage(view.items.map(toFeedItemDto), view.nextOffset);
}

function toPostDetailResponse(view: PostDetailView): PostDetailResponseDto {
  return {
    shortId: view.shortId,
    slug: view.slug,
    title: view.title,
    cefrLevel: view.cefrLevel,
    publishedAt: view.publishedAt,
    attributionText: view.attributionText,
    sourceType: view.sourceType,
    sourceLink: view.sourceLink,
    doc: view.doc,
    annotations: toAnnotationsDto(view.annotations),
    exercises: view.exercises.map((exercise) => ({
      id: exercise.id,
      type: exercise.type,
      source: exercise.source,
      payload: exercise.payload,
    })),
  };
}

function toAnnotationsDto(
  annotations: PostDetailView['annotations'],
): PostAnnotationsDto {
  return {
    words: mapRecord(annotations.words, (word) => ({
      wordDefinitionId: word.wordDefinitionId,
      wordId: word.wordId,
      lemma: word.lemma,
      pos: word.pos,
      definition: word.definition,
      phonetic: word.phonetic,
      example: word.example,
      cefrLevel: word.cefrLevel,
      frequencyRank: word.frequencyRank,
    })),
    phrases: mapRecord(annotations.phrases, (phrase) => ({
      phraseId: phrase.phraseId,
      text: phrase.text,
      type: phrase.type,
      definition: phrase.definition,
      example: phrase.example,
      cefrLevel: phrase.cefrLevel,
    })),
    grammar: mapRecord(annotations.grammar, (entry) => ({
      slug: entry.slug,
      name: entry.name,
      cefrLevel: entry.cefrLevel,
      usagePoints: entry.usagePoints.map((point) => ({
        grammarUsagePointId: point.grammarUsagePointId,
        cefrLevel: point.cefrLevel,
        guideword: point.guideword,
        canDoStatement: point.canDoStatement,
        exampleText: point.exampleText,
      })),
    })),
  };
}

function toGrammarReferenceResponse(
  view: GrammarReferenceView,
): GrammarReferenceResponseDto {
  return {
    categories: view.categories.map((category) => ({
      name: category.name,
      constructions: category.constructions.map((construction) => ({
        slug: construction.slug,
        name: construction.name,
        cefrLevel: construction.cefrLevel,
        usagePointCount: construction.usagePointCount,
      })),
    })),
  };
}

function toGrammarConstructionResponse(
  view: GrammarConstructionView,
): GrammarConstructionResponseDto {
  return {
    slug: view.slug,
    name: view.name,
    categoryName: view.categoryName,
    cheatSheetContent: view.cheatSheetContent,
    cefrLevel: view.cefrLevel,
    usagePoints: view.usagePoints.map((point) => ({
      grammarUsagePointId: point.grammarUsagePointId,
      cefrLevel: point.cefrLevel,
      guideword: point.guideword,
      canDoStatement: point.canDoStatement,
      exampleText: point.exampleText,
    })),
  };
}

function mapRecord<In, Out>(
  source: Record<string, In>,
  map: (value: In) => Out,
): Record<string, Out> {
  const out: Record<string, Out> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = map(value);
  }
  return out;
}
