import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post as PostRoute,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { CurrentUserOrNull } from '../../../../core/decorators/current-user-or-null.decorator.js';
import { Public } from '../../../../core/decorators/public.decorator.js';
import { toCursorPage } from '../../../../core/http/dto/cursor-page.js';
import { toOffsetPage } from '../../../../core/http/dto/offset-page.js';
import { CachePolicy } from '../../../../core/http/interceptors/etag.interceptor.js';
import { PostService } from '../../../../modules/post/post.service.js';
import type {
  FeedItemView,
  FeedView,
} from '../../../../modules/post/queries/get-feed/feed-view.js';
import type { GrammarConstructionView } from '../../../../modules/post/queries/get-grammar-construction/grammar-construction-view.js';
import type { GrammarReferenceView } from '../../../../modules/post/queries/get-grammar-reference/grammar-reference-view.js';
import type { PostDetailView } from '../../../../modules/post/queries/get-post-detail/post-detail-view.js';
import type {
  PostsListItemView,
  PostsListView,
} from '../../../../modules/post/queries/get-posts-list/posts-list-view.js';
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
import { PostSuggestionsQueryDto } from '../dto/post-suggestions-query.dto.js';
import { PostSuggestionsResponseDto } from '../dto/post-suggestions-response.dto.js';
import { PostsListQueryDto } from '../dto/posts-list-query.dto.js';
import {
  PostsListItemDto,
  PostsListResponseDto,
} from '../dto/posts-list-response.dto.js';

// Guest-readable content surface (PLAN.md §2, §4): the post feed, a single
// post with its inline analysis, and the grammar reference. Served under
// `/api/content/*` — the path prefix keeps these routes from colliding with a
// future top-level resource. Each endpoint maps its module view onto a web DTO
// explicitly (no structural passthrough) so the HTTP contract stays decoupled
// from the module's internal query shapes.
//
// Every route is an anonymous, cacheable GET, so `@CachePolicy('public')` sits
// on the class: `ETagInterceptor` then emits `Cache-Control: public` + a
// content ETag and answers a matching `If-None-Match` with 304.
@ApiTags('content')
@CachePolicy('public')
@Controller('content')
export class ContentController {
  constructor(private readonly post: PostService) {}

  // The `/` feed: published posts, newest first, offset-paginated.
  @Public()
  @Get('feed')
  async feed(@Query() query: FeedQueryDto): Promise<FeedResponseDto> {
    const view = await this.post.getFeed(query.limit, query.offset);
    return toFeedResponse(view);
  }

  // The `/posts` archive: published posts, newest first, keyset-paginated —
  // CEFR multi-select + "unread only" (posts-list-page §1). A distinct
  // endpoint from `feed` above: different filter shape (CEFR multi-select,
  // unread toggle) and pagination model (cursor, not offset).
  @Public()
  @Get('posts')
  async postsList(
    @Query() query: PostsListQueryDto,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<PostsListResponseDto> {
    const view = await this.post.getPostsList(actor?.id ?? null, {
      cefrLevels: query.cefr,
      term: query.term,
      unreadOnly: query.unreadOnly,
      cursor: query.cursor,
      limit: query.limit,
    });
    return toPostsListResponse(view);
  }

  // Autocomplete for the `/posts` search box (posts-list-page §2): words and
  // phrases with a published post behind them. Declared before
  // `posts/:slugId` so `suggestions` is not parsed as a slug-id.
  @Public()
  @Get('posts/suggestions')
  async postSuggestions(
    @Query() query: PostSuggestionsQueryDto,
  ): Promise<PostSuggestionsResponseDto> {
    const view = await this.post.getPostSuggestions(query.q, query.limit);
    return { items: view.items.map(({ type, text }) => ({ type, text })) };
  }

  // One post for `/posts/{slug}-{id}`: node tree + resolved annotations +
  // exercises + the sidebar's per-user card state. The sidebar makes this
  // response vary by session even though the route stays @Public() for
  // guests, so it overrides the class-level public cache policy — a shared
  // cache must never reuse one user's personalized response for another.
  @Public()
  @CachePolicy('private')
  @Get('posts/:slugId')
  async postDetail(
    @Param('slugId') slugId: string,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<PostDetailResponseDto> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    const view = await this.post.getPostDetail(shortId, actor?.id ?? null);
    if (!view) {
      throw new NotFoundException('Post not found');
    }
    return toPostDetailResponse(view);
  }

  // Marks the post read for the current user (PLAN.md §16/§17 Track B) —
  // fired when the comprehension quiz is submitted, regardless of
  // correctness. Requires login (unlike every other route here): a guest has
  // no persistent identity to attach a read record to.
  @ApiCookieAuth()
  @PostRoute('posts/:slugId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markPostRead(
    @Param('slugId') slugId: string,
    @CurrentUser() actor: UserActor,
  ): Promise<void> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    await this.post.markPostRead(actor.id, shortId);
  }

  // The `/grammar` reference index: 19 categories → constructions. Varies by
  // session once logged in (per-construction state), so it overrides the
  // class-level public cache policy the same way `postDetail` does.
  @Public()
  @CachePolicy('private')
  @Get('grammar')
  async grammar(
    @Query() query: GrammarReferenceQueryDto,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<GrammarReferenceResponseDto> {
    const view = await this.post.getGrammarReference(
      query.cefr ?? null,
      actor?.id ?? null,
    );
    return toGrammarReferenceResponse(view);
  }

  // One construction for `/grammar/{slug}`: cheat sheet + usage points, each
  // with its own per-user state gating its "+ Add to deck" button.
  @Public()
  @CachePolicy('private')
  @Get('grammar/:slug')
  async grammarConstruction(
    @Param('slug') slug: string,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<GrammarConstructionResponseDto> {
    const view = await this.post.getGrammarConstruction(
      slug,
      actor?.id ?? null,
    );
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

function toPostsListItemDto(item: PostsListItemView): PostsListItemDto {
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

function toPostsListResponse(view: PostsListView): PostsListResponseDto {
  return toCursorPage(view.items.map(toPostsListItemDto), view.nextCursor);
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
    sidebar: {
      grammar: view.sidebar.grammar.map((entry) => ({
        slug: entry.slug,
        name: entry.name,
        state: entry.state,
      })),
      words: view.sidebar.words.map((entry) => ({
        wordDefinitionId: entry.wordDefinitionId,
        lemma: entry.lemma,
        state: entry.state,
      })),
      phrases: view.sidebar.phrases.map((entry) => ({
        phraseId: entry.phraseId,
        text: entry.text,
        state: entry.state,
      })),
    },
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
        state: construction.state,
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
      state: point.state,
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
