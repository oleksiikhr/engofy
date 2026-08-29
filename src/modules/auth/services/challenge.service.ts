import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { REDIS_CLIENT } from '../../../core/redis/redis.tokens.js';
import AuthConfig from '../config/auth.config.js';
import {
  generateOtp,
  hashSecret,
  normalizeEmail,
  timingSafeEqualHex,
} from '../crypto/token.helper.js';
import { AuthChallenge } from '../entities/auth-challenge.entity.js';
import { InvalidOrExpiredChallengeError } from '../errors/invalid-or-expired-challenge.error.js';
import { TooManyAttemptsError } from '../errors/too-many-attempts.error.js';

// Bumps the per-email and per-IP counters together in one round-trip, arming a
// TTL on each the first time it appears in the window. Returns 1 when both stay
// within their limits, 0 as soon as either is exceeded — the two keys close
// different abuse vectors (one email from many IPs, many emails from one IP), so
// both must pass. Both counters increment even when the other already denies.
const ALLOW_REQUEST_SCRIPT = `
local emailCount = redis.call('INCR', KEYS[1])
if emailCount == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ipCount = redis.call('INCR', KEYS[2])
if ipCount == 1 then
  redis.call('PEXPIRE', KEYS[2], ARGV[1])
end
if emailCount > tonumber(ARGV[2]) or ipCount > tonumber(ARGV[3]) then
  return 0
end
return 1
`;

export interface IssuedChallenge {
  email: string;
  otp: string;
}

export interface RedeemedChallenge {
  email: string;
}

@Injectable()
export class ChallengeService {
  constructor(
    private readonly em: EntityManager,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(AuthConfig.KEY)
    private readonly config: ConfigType<typeof AuthConfig>,
  ) {}

  async issue(email: string): Promise<IssuedChallenge> {
    const normalized = normalizeEmail(email);
    const otp = generateOtp();

    await this.em.upsert(
      AuthChallenge,
      {
        id: uuidv7(),
        email: normalized,
        otpHash: hashSecret(otp),
        attempts: 0,
        expiresAt: DateTime.now().plus({
          milliseconds: this.config.challengeTtlMs,
        }),
      },
      {
        onConflictFields: ['email'],
        onConflictAction: 'merge',
        onConflictExcludeFields: ['id'],
      },
    );

    return { email: normalized, otp };
  }

  async consumeByOtp(email: string, code: string): Promise<RedeemedChallenge> {
    const normalized = normalizeEmail(email);

    const attempts = await this.incrementAttempts(normalized);
    if (attempts === null) {
      throw new InvalidOrExpiredChallengeError();
    }

    if (attempts > this.config.otpMaxAttempts) {
      await this.em.nativeDelete(AuthChallenge, { email: normalized }); // run immediately
      throw new TooManyAttemptsError();
    }

    const challenge = await this.em.findOne(AuthChallenge, {
      email: normalized,
    });

    if (
      !challenge ||
      challenge.expiresAt <= DateTime.now() ||
      !timingSafeEqualHex(challenge.otpHash, hashSecret(code))
    ) {
      throw new InvalidOrExpiredChallengeError();
    }

    this.em.remove(challenge);

    return { email: challenge.email };
  }

  async allowRequest(email: string, ip: string): Promise<boolean> {
    const normalized = normalizeEmail(email);

    const allowed = await this.redis.eval(
      ALLOW_REQUEST_SCRIPT,
      2,
      `otp:email:${normalized}`,
      `otp:ip:${ip || 'unknown'}`,
      this.config.requestLimitWindowMs,
      this.config.requestLimitPerEmail,
      this.config.requestLimitPerIp,
    );

    return allowed === 1;
  }

  private async incrementAttempts(email: string): Promise<number | null> {
    const rows = await this.em
      .getConnection()
      .execute<{ attempts: number }[]>(
        'UPDATE auth_challenges SET attempts = attempts + 1 WHERE email = ? RETURNING attempts',
        [email],
        'all',
        this.em.getTransactionContext(),
      );

    return rows.length > 0 ? rows[0].attempts : null;
  }
}
