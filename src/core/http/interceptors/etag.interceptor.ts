import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isObservable, type Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

function ifNoneMatchHit(
  ifNoneMatch: string | undefined,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  return ifNoneMatch.split(',').some((c) => c.trim() === etag);
}

export const CACHE_POLICY_KEY = 'cachePolicy';

export const CachePolicy = (policy: 'private' | 'public') =>
  SetMetadata(CACHE_POLICY_KEY, policy);

@Injectable()
export class ETagInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (request.method !== 'GET') {
      return next.handle();
    }

    const policy = this.reflector.getAllAndOverride<'private' | 'public'>(
      CACHE_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<FastifyReply>();
    const ifNoneMatch = request.headers['if-none-match'];

    return next.handle().pipe(
      switchMap((data) => {
        response.header('Cache-Control', policy);

        // Streams and SSE observables cannot be buffered for ETag computation.
        // Pass them through unchanged so Fastify handles them natively.
        if (
          data instanceof Readable ||
          Buffer.isBuffer(data) ||
          isObservable(data)
        ) {
          return of(data);
        }

        const etag = `"${createHash('sha1').update(JSON.stringify(data)).digest('hex')}"`;
        response.header('ETag', etag);

        if (ifNoneMatchHit(ifNoneMatch, etag)) {
          // Set status only — do not call .send() here.
          // NestJS calls reply.send(null) after the interceptor completes, which
          // Fastify handles correctly: 304 responses are sent without a body.
          response.code(304);
          return of(null);
        }

        return of(data);
      }),
    );
  }
}
