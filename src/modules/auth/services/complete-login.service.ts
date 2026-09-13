import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../entities/user.entity.js';
import type { LoginResult } from '../types/login-result.type.js';
import { SessionService } from './session.service.js';

@Injectable()
export class CompleteLoginService {
  constructor(
    private readonly em: EntityManager,
    private readonly sessions: SessionService,
  ) {}

  async loginByEmail(email: string): Promise<LoginResult> {
    const { user, isNewUser } = await this.findOrCreateUser(email);
    const sessionToken = this.sessions.create(user.id);

    return { userId: user.id, sessionToken, isNewUser };
  }

  async loginByGoogle(email: string, googleSub: string): Promise<LoginResult> {
    const { user, isNewUser } = await this.findOrCreateUser(email, googleSub);

    // Backfill `googleSub` on a row first created by an email login. `googleSub`
    // is `@Unique`, so if the same Google account's primary email later changes
    // Google-side, a second row could take this `googleSub` and the flush would
    // hit the unique constraint. Accepted for MVP — Google email changes are
    // rare and the 500 is recoverable by retrying the login.
    if (user.googleSub !== googleSub) {
      user.googleSub = googleSub;
    }

    const sessionToken = this.sessions.create(user.id);

    return { userId: user.id, sessionToken, isNewUser };
  }

  // `upsert` stays the concurrency-safe primitive (two simultaneous logins
  // for the same brand-new email must not create two rows) — generating the
  // id up front and comparing it to the row `upsert` actually returns tells
  // us whether this call won the insert (new user) or hit the existing row
  // (conflict, ignored) without a separate find-then-create race window.
  private async findOrCreateUser(
    email: string,
    googleSub?: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const id = uuidv7();
    const user = await this.em.upsert(
      User,
      { id, email, googleSub: googleSub ?? null },
      { onConflictFields: ['email'], onConflictAction: 'ignore' },
    );

    return { user, isNewUser: user.id === id };
  }
}
