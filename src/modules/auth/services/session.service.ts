import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AuthConfig from '../config/auth.config.js';
import { generateToken, hashSecret } from '../crypto/token.helper.js';
import { AuthSession } from '../entities/auth-session.entity.js';

@Injectable()
export class SessionService {
  constructor(
    private readonly em: EntityManager,
    @Inject(AuthConfig.KEY)
    private readonly config: ConfigType<typeof AuthConfig>,
  ) {}

  async create(userId: string): Promise<string> {
    const token = generateToken();

    this.em.create(AuthSession, {
      userId,
      tokenHash: hashSecret(token),
      expiresAt: DateTime.now().plus({
        milliseconds: this.config.sessionTtlMs,
      }),
    });

    return token;
  }

  async resolveUserId(token: string): Promise<string | null> {
    const session = await this.em.findOne(AuthSession, {
      tokenHash: hashSecret(token),
    });

    if (!session || session.expiresAt <= DateTime.now()) {
      return null;
    }

    return session.userId;
  }

  async revoke(token: string): Promise<void> {
    const session = await this.em.findOne(AuthSession, {
      tokenHash: hashSecret(token),
    });
    if (!session) {
      return;
    }

    this.em.remove(session);
  }

  async refresh(token: string): Promise<void> {
    const now = DateTime.now();
    const refreshIfExpiringBefore = now.plus({
      milliseconds: this.config.sessionRefreshThresholdMs,
    });

    await this.em.getConnection().execute(
      `UPDATE auth_sessions SET expires_at = ?
       WHERE token_hash = ? AND expires_at > ? AND expires_at < ?`,
      [
        now.plus({ milliseconds: this.config.sessionTtlMs }).toJSDate(),
        hashSecret(token),
        now.toJSDate(),
        refreshIfExpiringBefore.toJSDate(),
      ],
      'run',
      this.em.getTransactionContext(),
    );
  }
}
