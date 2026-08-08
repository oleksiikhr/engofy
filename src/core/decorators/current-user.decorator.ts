import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserActor } from '../actor/actor.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserActor => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const actor = request.raw.actor;

    if (actor?.type !== 'user') {
      throw new Error('CurrentUser decorator requires an authenticated user');
    }

    return actor;
  },
);
