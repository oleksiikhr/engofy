import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { createWebE2ESuite } from '../../../../test/http/web/setup/e2e-suite.helper.js';
import { InternalWebModule } from '../../../entrypoints/web/internal/internal-web.module.js';
import type { CreatedResponseDto } from '../dto/created-response.dto.js';
import { CachePolicy } from './etag.interceptor.js';

const ETAG_PATTERN = /^"[a-f0-9]+"$/;

interface Widget {
  id: string;
  name: string;
}

@Controller('etag-test')
class EtagTestController {
  private readonly widgets = new Map<string, Widget>();

  @Get('config')
  @CachePolicy('private')
  getConfig(): { value: string } {
    return { value: 'private-config' };
  }

  @Get('public-config')
  @CachePolicy('public')
  getPublicConfig(): { value: string } {
    return { value: 'public-config' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(): CreatedResponseDto {
    const widget: Widget = { id: randomUUID(), name: 'Widget' };
    this.widgets.set(widget.id, widget);

    return { id: widget.id };
  }

  @Get(':id')
  @CachePolicy('private')
  getOne(@Param('id') id: string): Widget | undefined {
    return this.widgets.get(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@Param('id') id: string, @Body() body: { name: string }): void {
    const existing = this.widgets.get(id);

    if (existing) {
      this.widgets.set(id, { ...existing, name: body.name });
    }
  }
}

@Module({ controllers: [EtagTestController] })
class EtagTestModule {}

describe('ETagInterceptor', () => {
  const suite = createWebE2ESuite({
    imports: [InternalWebModule, EtagTestModule],
  });

  async function fetchEtag(): Promise<string> {
    const res = await suite
      .request('get', '/etag-test/config')
      .expect(HttpStatus.OK);
    return res.headers.etag as string;
  }

  // ---------------------------------------------------------------------------
  // Opt-out: no @CachePolicy on handler or class
  // ---------------------------------------------------------------------------

  it('does not set ETag when no @CachePolicy decorator is present', async () => {
    const res = await suite
      .request('get', '/_healthz', { authed: false })
      .expect(HttpStatus.OK);

    expect(res.headers.etag).toBeUndefined();
    // Cache-Control may be set by other mechanisms (e.g. @nestjs/terminus) — not our concern here
  });

  // ---------------------------------------------------------------------------
  // Opt-out: non-GET requests
  // ---------------------------------------------------------------------------

  it('does not set ETag or Cache-Control on non-GET requests', async () => {
    const res = await suite
      .request('post', '/etag-test')
      .expect(HttpStatus.CREATED);

    expect(res.headers.etag).toBeUndefined();
    expect(res.headers['cache-control']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Cache-Control header
  // ---------------------------------------------------------------------------

  it('sets Cache-Control: private for @CachePolicy("private") routes', async () => {
    const res = await suite
      .request('get', '/etag-test/config')
      .expect(HttpStatus.OK);

    expect(res.headers['cache-control']).toBe('private');
  });

  it('sets Cache-Control: public for @CachePolicy("public") routes', async () => {
    const res = await suite
      .request('get', '/etag-test/public-config', { authed: false })
      .expect(HttpStatus.OK);

    expect(res.headers['cache-control']).toBe('public');
  });

  // ---------------------------------------------------------------------------
  // ETag generation
  // ---------------------------------------------------------------------------

  it('sets a quoted hex ETag on 200 responses', async () => {
    const res = await suite
      .request('get', '/etag-test/config')
      .expect(HttpStatus.OK);

    expect(res.headers.etag).toMatch(ETAG_PATTERN);
  });

  // ---------------------------------------------------------------------------
  // If-None-Match: cache hit variants → 304
  // ---------------------------------------------------------------------------

  it('returns 304 when If-None-Match matches the current ETag exactly', async () => {
    const etag = await fetchEtag();

    await suite
      .request('get', '/etag-test/config')
      .set('If-None-Match', etag)
      .expect(HttpStatus.NOT_MODIFIED);
  });

  it('returns 304 when If-None-Match is a comma-separated list containing a match', async () => {
    const etag = await fetchEtag();

    await suite
      .request('get', '/etag-test/config')
      .set(
        'If-None-Match',
        `"0000000000000000000000000000000000000000", ${etag}`,
      )
      .expect(HttpStatus.NOT_MODIFIED);
  });

  // ---------------------------------------------------------------------------
  // If-None-Match: cache miss → 200
  // ---------------------------------------------------------------------------

  it('returns 200 with a new ETag when If-None-Match is stale', async () => {
    const res = await suite
      .request('get', '/etag-test/config')
      .set('If-None-Match', '"0000000000000000000000000000000000000000"')
      .expect(HttpStatus.OK);

    expect(res.headers.etag).toMatch(ETAG_PATTERN);
  });

  it('returns 200 when a weak validator does not match the current ETag', async () => {
    const res = await suite
      .request('get', '/etag-test/config')
      .set('If-None-Match', 'W/"0000000000000000000000000000000000000000"')
      .expect(HttpStatus.OK);

    expect(res.headers.etag).toMatch(ETAG_PATTERN);
  });

  // ---------------------------------------------------------------------------
  // 304 response headers — caches must receive ETag + Cache-Control to revalidate
  // ---------------------------------------------------------------------------

  it('includes ETag and Cache-Control headers on 304 responses', async () => {
    const etag = await fetchEtag();

    const res = await suite
      .request('get', '/etag-test/config')
      .set('If-None-Match', etag)
      .expect(HttpStatus.NOT_MODIFIED);

    expect(res.headers.etag).toBe(etag);
    expect(res.headers['cache-control']).toBe('private');
  });

  // ---------------------------------------------------------------------------
  // Cache invalidation — stale ETag must not produce 304 after data changes
  // ---------------------------------------------------------------------------

  it('returns 200 with a new ETag after the resource is mutated', async () => {
    const { id } = (
      await suite.request('post', '/etag-test').expect(HttpStatus.CREATED)
    ).body as CreatedResponseDto;

    const firstRes = await suite
      .request('get', `/etag-test/${id}`)
      .expect(HttpStatus.OK);
    const staleEtag = firstRes.headers.etag as string;
    expect(staleEtag).toMatch(ETAG_PATTERN);

    await suite
      .request('patch', `/etag-test/${id}`)
      .send({ name: 'Updated Name' })
      .expect(HttpStatus.NO_CONTENT);

    const secondRes = await suite
      .request('get', `/etag-test/${id}`)
      .set('If-None-Match', staleEtag)
      .expect(HttpStatus.OK);

    expect(secondRes.headers.etag).toMatch(ETAG_PATTERN);
    expect(secondRes.headers.etag).not.toBe(staleEtag);
  });
});
