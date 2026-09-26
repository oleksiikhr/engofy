import {
  Body,
  Controller,
  Delete,
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
import { CachePolicy } from '../../../../core/http/interceptors/etag.interceptor.js';
import { PostService } from '../../../../modules/post/post.service.js';
import type { GrammarConstructionView } from '../../../../modules/post/queries/get-grammar-construction/grammar-construction-view.js';
import type { GrammarReferenceView } from '../../../../modules/post/queries/get-grammar-reference/grammar-reference-view.js';
import type { PostDetailView } from '../../../../modules/post/queries/get-post-detail/post-detail-view.js';
import type {
  PostsListItemView,
  PostsListView,
} from '../../../../modules/post/queries/get-posts-list/posts-list-view.js';
import { parseSlugId } from '../../../../modules/post/queries/parse-slug-id.js';
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
import { PostsSitemapPageParamDto } from '../dto/posts-sitemap-page-param.dto.js';
import {
  PostsSitemapIndexResponseDto,
  PostsSitemapPageResponseDto,
} from '../dto/posts-sitemap-response.dto.js';
import { ReportLabelBodyDto } from '../dto/report-label-body.dto.js';
import { UsagePointExercisesResponseDto } from '../dto/usage-point-exercises-response.dto.js';

// Guest-readable content surface (PLAN.md §2, §4): the posts archive, a single
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

  // The `/posts` archive: published posts, newest first, keyset-paginated —
  // CEFR and topic multi-selects + "unread only" (posts-list-page §1). `isRead` and
  // `unreadOnly` make the response vary by session, so it overrides the
  // class-level public cache policy like `posts/:slugId` does.
  @Public()
  @CachePolicy('private')
  @Get('posts')
  async postsList(
    @Query() query: PostsListQueryDto,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<PostsListResponseDto> {
    const view = await this.post.getPostsList(actor?.id ?? null, {
      cefrLevels: query.cefr,
      topics: query.topic,
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

  // Sitemap index for published posts: one entry per fixed-size page, each
  // with the newest content change on it. `apps/web` renders
  // `/sitemap/posts.xml` from this.
  @Public()
  @Get('sitemap/posts')
  async postsSitemapIndex(): Promise<PostsSitemapIndexResponseDto> {
    const view = await this.post.getPostsSitemapIndex();
    return {
      pages: view.pages.map(({ page, lastmod }) => ({ page, lastmod })),
    };
  }

  // One sitemap page (`/sitemap/posts-{page}.xml`): `slug` + `shortId` build
  // the url, `lastmod` is the content-change time. A page past the last one
  // is a 404.
  @Public()
  @Get('sitemap/posts/:page')
  async postsSitemapPage(
    @Param() params: PostsSitemapPageParamDto,
  ): Promise<PostsSitemapPageResponseDto> {
    const view = await this.post.getPostsSitemapPage(params.page);
    if (view.items.length === 0) {
      throw new NotFoundException('Sitemap page not found');
    }
    return {
      items: view.items.map(({ slug, shortId, lastmod }) => ({
        slug,
        shortId,
        lastmod,
      })),
    };
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
  // the reader's "Mark as read" button, scrolling to the end, or finishing
  // study mode. Requires login (unlike every other route here): a guest has
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

  // Reverts the mark above ("Mark as unread"); idempotent when the post
  // isn't marked read.
  @ApiCookieAuth()
  @Delete('posts/:slugId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmarkPostRead(
    @Param('slugId') slugId: string,
    @CurrentUser() actor: UserActor,
  ): Promise<void> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    await this.post.unmarkPostRead(actor.id, shortId);
  }

  // "Report a mistake" in the reader popup: records that a word/phrase/grammar
  // label looks wrong, as a structured log event (no table). Open to guests —
  // the label is public content — with the reporter's id when signed in.
  @Public()
  @PostRoute('posts/:slugId/label-reports')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportLabel(
    @Param('slugId') slugId: string,
    @Body() body: ReportLabelBodyDto,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<void> {
    const shortId = parseSlugId(slugId);
    if (!shortId) {
      throw new NotFoundException('Post not found');
    }
    await this.post.reportLabel(actor?.id ?? null, shortId, body);
  }

  // The `/grammar` reference index: constructions grouped by category / time /
  // CEFR (`groupBy`). Varies by session once logged in (per-construction
  // state), so it overrides the class-level public cache policy the same way
  // `postDetail` does.
  @Public()
  @CachePolicy('private')
  @Get('grammar')
  async grammar(
    @Query() query: GrammarReferenceQueryDto,
    @CurrentUserOrNull() actor: UserActor | null,
  ): Promise<GrammarReferenceResponseDto> {
    const view = await this.post.getGrammarReference(
      { cefrLevels: query.cefr ?? [], groupBy: query.groupBy },
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

  // The reusable exercise pool for one usage point (PLAN.md grammar-usage-
  // -point-exercises, slice 5) — the exercises section under each usage point
  // on `/grammar/{slug}`. `:slug` isn't used to look anything up (usagePointId
  // is already globally unique); it's kept in the path for URL readability,
  // matching the page it's fetched from. Not user-specific: no override of
  // the class-level public cache policy.
  @Public()
  @Get('grammar/:slug/usage-points/:usagePointId/exercises')
  async usagePointExercises(
    @Param('usagePointId') usagePointId: string,
  ): Promise<UsagePointExercisesResponseDto> {
    const view = await this.post.getUsagePointExercises(usagePointId);
    return {
      items: view.items.map((item) => ({
        id: item.id,
        type: item.type,
        payload: item.payload,
      })),
    };
  }
}

function toPostsListItemDto(item: PostsListItemView): PostsListItemDto {
  return {
    shortId: item.shortId,
    slug: item.slug,
    title: item.title,
    cefrLevel: item.cefrLevel,
    topic: item.topic,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt,
    attributionText: item.attributionText,
    sourceType: item.sourceType,
    sourceLink: item.sourceLink,
    isRead: item.isRead,
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
    isRead: view.isRead,
    doc: view.doc,
    annotations: toAnnotationsDto(view.annotations),
    exercises: view.exercises.map((exercise) => ({
      id: exercise.id,
      type: exercise.type,
      source: exercise.source,
      payload: exercise.payload,
      blockIndex: exercise.blockIndex,
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
      translations: word.translations,
      cefrLevel: word.cefrLevel,
      frequencyRank: word.frequencyRank,
      state: word.state,
    })),
    phrases: mapRecord(annotations.phrases, (phrase) => ({
      phraseId: phrase.phraseId,
      text: phrase.text,
      type: phrase.type,
      definition: phrase.definition,
      example: phrase.example,
      translations: phrase.translations,
      cefrLevel: phrase.cefrLevel,
      state: phrase.state,
    })),
    grammar: mapRecord(annotations.grammar, (entry) => ({
      slug: entry.slug,
      name: entry.name,
      cefrLevel: entry.cefrLevel,
      usagePoints: entry.usagePoints.map((point) => ({
        grammarUsagePointId: point.grammarUsagePointId,
        egpIndex: point.egpIndex,
        cefrLevel: point.cefrLevel,
        guideword: point.guideword,
        canDoStatement: point.canDoStatement,
        explanation: point.explanation,
        translations: point.translations,
        examples: point.examples,
      })),
    })),
    grammarMatches: annotations.grammarMatches.map((match) => ({
      blockIndex: match.blockIndex,
      itemIndex: match.itemIndex,
      charStart: match.charStart,
      charEnd: match.charEnd,
      grammarUsagePointId: match.grammarUsagePointId,
      state: match.state,
    })),
    tokens: annotations.tokens.map((token) => ({
      blockIndex: token.blockIndex,
      itemIndex: token.itemIndex,
      charStart: token.charStart,
      charEnd: token.charEnd,
      pos: token.pos,
      tense: token.tense,
      irregular: token.irregular && {
        base: token.irregular.base,
        pastSimple: token.irregular.pastSimple,
        pastParticiple: token.irregular.pastParticiple,
      },
    })),
  };
}

function toGrammarReferenceResponse(
  view: GrammarReferenceView,
): GrammarReferenceResponseDto {
  const groups = view.groups.map((group) => ({
    key: group.key,
    name: group.name,
    constructions: group.constructions.map((construction) => ({
      slug: construction.slug,
      name: construction.name,
      cefrLevel: construction.cefrLevel,
      usagePointCount: construction.usagePointCount,
      summary: construction.summary,
      state: construction.state,
      learnedCount: construction.learnedCount,
    })),
  }));
  return { groups };
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
      egpIndex: point.egpIndex,
      cefrLevel: point.cefrLevel,
      guideword: point.guideword,
      canDoStatement: point.canDoStatement,
      explanation: point.explanation,
      examples: point.examples,
      state: point.state,
      assumedKnown: point.assumedKnown,
    })),
    levelProgress: view.levelProgress,
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
