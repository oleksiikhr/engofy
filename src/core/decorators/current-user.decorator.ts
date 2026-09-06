import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserActor } from '../actor/actor.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserActor => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const actor = request.raw.actor;

    if (actor?.type !== 'user') {
      // A route using @CurrentUser without the auth guard (or a guard change
      // that lets an unauthenticated request through) is a 401, not a 500.
      throw new UnauthorizedException('Authentication required');
    }

    return actor;
  },
);
