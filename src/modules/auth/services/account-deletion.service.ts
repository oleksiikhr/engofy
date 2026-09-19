import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AuthConfig from '../config/auth.config.js';
import { generateToken, hashSecret } from '../crypto/token.helper.js';
import { AccountDeletionRequest } from '../entities/account-deletion-request.entity.js';
import { AccountDeletionRequestNotFoundError } from '../errors/account-deletion-request-not-found.error.js';
import type { AccountDeletionView } from '../types/account-deletion-view.type.js';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly em: EntityManager,
    @Inject(AuthConfig.KEY)
    private readonly config: ConfigType<typeof AuthConfig>,
  ) {}

  findActive(userId: string): Promise<AccountDeletionRequest | null> {
    return this.em.findOne(AccountDeletionRequest, {
      userId,
      cancelledAt: null,
    });
  }

  // Deferred write (no flush) so the row commits with the e-mail job the
  // caller stages next. The plaintext token exists only here, to be mailed.
  issue(userId: string): {
    request: AccountDeletionRequest;
    cancelToken: string;
  } {
    const cancelToken = generateToken();
    const request = this.em.create(AccountDeletionRequest, {
      userId,
      cancelTokenHash: hashSecret(cancelToken),
    });

    return { request, cancelToken };
  }

  async cancelForUser(userId: string): Promise<void> {
    const request = await this.findActive(userId);
    if (!request) {
      throw new AccountDeletionRequestNotFoundError();
    }

    request.cancelledAt = DateTime.now();
  }

  async cancelByToken(cancelToken: string): Promise<void> {
    const request = await this.em.findOne(AccountDeletionRequest, {
      cancelTokenHash: hashSecret(cancelToken),
      cancelledAt: null,
    });
    if (!request) {
      throw new AccountDeletionRequestNotFoundError();
    }

    request.cancelledAt = DateTime.now();
  }

  toView(request: AccountDeletionRequest): AccountDeletionView {
    return {
      requestedAt: request.requestedAt,
      scheduledFor: request.requestedAt.plus({
        days: this.config.accountDeletionGraceDays,
      }),
    };
  }
}
