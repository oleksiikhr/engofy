import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserActor } from '../actor/actor.js';

// Same source as CurrentUser (SessionAuthGuard still populates
// `request.raw.actor` for a valid session even on a @Public() route), but
// never throws — for a route a guest can use that personalizes when a
// session happens to be present (e.g. the reader sidebar's per-card state).
export const CurrentUserOrNull = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserActor | null => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const actor = request.raw.actor;

    return actor?.type === 'user' ? actor : null;
  },
);
