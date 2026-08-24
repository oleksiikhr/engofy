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
    const user = await this.findOrCreateUser(email);
    const sessionToken = await this.sessions.create(user.id);

    return { userId: user.id, sessionToken };
  }

  async loginByGoogle(email: string, googleSub: string): Promise<LoginResult> {
    const user = await this.findOrCreateUser(email, googleSub);

    if (user.googleSub !== googleSub) {
      user.googleSub = googleSub;
    }

    const sessionToken = await this.sessions.create(user.id);

    return { userId: user.id, sessionToken };
  }

  private async findOrCreateUser(
    email: string,
    googleSub?: string,
  ): Promise<User> {
    return this.em.upsert(
      User,
      { id: uuidv7(), email, googleSub: googleSub ?? null },
      { onConflictFields: ['email'], onConflictAction: 'ignore' },
    );
  }
}
