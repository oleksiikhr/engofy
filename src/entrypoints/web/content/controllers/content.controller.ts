import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../core/decorators/public.decorator.js';
import { PostService } from '../../../../modules/post/post.service.js';
import { parseSlugId } from '../../../../modules/post/queries/parse-slug-id.js';
import { FeedQueryDto } from '../dto/feed-query.dto.js';
import { FeedResponseDto } from '../dto/feed-response.dto.js';
import { GrammarConstructionResponseDto } from '../dto/grammar-construction-response.dto.js';
import { GrammarReferenceQueryDto } from '../dto/grammar-reference-query.dto.js';
import { GrammarReferenceResponseDto } from '../dto/grammar-reference-response.dto.js';
import { PostDetailResponseDto } from '../dto/post-detail-response.dto.js';

// Guest-readable content surface (PLAN.md §2, §4): the post feed, a single
// post with its inline analysis, and the grammar reference. Served under
// `/api/*` at the edge (the reverse proxy strips the prefix).
@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly post: PostService) {}

  // The `/` feed: published posts, newest first, offset-paginated.
  @Public()
  @Get('feed')
  feed(@Query() query: FeedQueryDto): Promise<FeedResponseDto> {
    return this.post.getFeed(query.limit, query.offset);
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
    return view;
  }

  // The `/grammar` reference index: 19 categories → constructions.
  @Public()
  @Get('grammar')
  grammar(
    @Query() query: GrammarReferenceQueryDto,
  ): Promise<GrammarReferenceResponseDto> {
    return this.post.getGrammarReference(query.cefr ?? null);
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
    return view;
  }
}
