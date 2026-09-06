import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../../../../core/decorators/public.decorator.js';
import { AuthService } from '../../../../modules/auth/auth.service.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import { readSessionCookie } from '../cookies/auth-cookies.helper.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    @Inject(AuthConfig.KEY)
    private readonly authConfig: ConfigType<typeof AuthConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = readSessionCookie(request, this.authConfig);

    if (!token) {
      if (isPublic) {
        return true;
      }

      throw new UnauthorizedException('Authentication required');
    }

    const resolved = await this.authService.resolveSession({
      sessionToken: token,
    });

    if (!resolved) {
      if (isPublic) {
        return true;
      }

      throw new UnauthorizedException('Session expired');
    }

    request.raw.actor = { type: 'user', id: resolved.userId };

    return true;
  }
}
