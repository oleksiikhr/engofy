import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LoginWithGoogleCommand } from './commands/login-with-google/login-with-google.command.js';
import type { LoginWithGoogleDto } from './commands/login-with-google/login-with-google.dto.js';
import { LogoutCommand } from './commands/logout/logout.command.js';
import type { LogoutDto } from './commands/logout/logout.dto.js';
import { RequestLoginCodeCommand } from './commands/request-login-code/request-login-code.command.js';
import type { RequestLoginCodeDto } from './commands/request-login-code/request-login-code.dto.js';
import {
  type ResolvedSession,
  ResolveSessionCommand,
} from './commands/resolve-session/resolve-session.command.js';
import { ResolveSessionDto } from './commands/resolve-session/resolve-session.dto.js';
import { VerifyLoginCodeCommand } from './commands/verify-login-code/verify-login-code.command.js';
import type { VerifyLoginCodeDto } from './commands/verify-login-code/verify-login-code.dto.js';
import type { User } from './entities/user.entity.js';
import { GetUserQuery } from './queries/get-user/get-user.query.js';
import type { LoginResult } from './types/login-result.type.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async requestLoginCode(dto: RequestLoginCodeDto, ip: string): Promise<void> {
    await this.commandBus.execute(new RequestLoginCodeCommand(dto, ip));

    await this.em.flush();
  }

  async verifyLoginCode(dto: VerifyLoginCodeDto): Promise<LoginResult> {
    const result = await this.commandBus.execute(
      new VerifyLoginCodeCommand(dto),
    );

    await this.em.flush();

    return result;
  }

  async loginWithGoogle(dto: LoginWithGoogleDto): Promise<LoginResult> {
    const result = await this.commandBus.execute(
      new LoginWithGoogleCommand(dto),
    );

    await this.em.flush();

    return result;
  }

  async logout(dto: LogoutDto): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(dto));

    await this.em.flush();
  }

  getUser(userId: string): Promise<User> {
    return this.queryBus.execute(new GetUserQuery(userId));
  }

  async resolveSession(
    dto: ResolveSessionDto,
  ): Promise<ResolvedSession | null> {
    const result = await this.commandBus.execute(
      new ResolveSessionCommand(dto),
    );

    await this.em.flush();

    return result;
  }
}
