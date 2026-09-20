import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { CefrLevel } from '../post/enums/cefr-level.enum.js';
import { CancelAccountDeletionCommand } from './commands/cancel-account-deletion/cancel-account-deletion.command.js';
import { CancelAccountDeletionByTokenCommand } from './commands/cancel-account-deletion-by-token/cancel-account-deletion-by-token.command.js';
import type { CancelAccountDeletionByTokenDto } from './commands/cancel-account-deletion-by-token/cancel-account-deletion-by-token.dto.js';
import { LoginWithGoogleCommand } from './commands/login-with-google/login-with-google.command.js';
import type { LoginWithGoogleDto } from './commands/login-with-google/login-with-google.dto.js';
import { LogoutCommand } from './commands/logout/logout.command.js';
import type { LogoutDto } from './commands/logout/logout.dto.js';
import { RequestAccountDeletionCommand } from './commands/request-account-deletion/request-account-deletion.command.js';
import { RequestLoginCodeCommand } from './commands/request-login-code/request-login-code.command.js';
import type { RequestLoginCodeDto } from './commands/request-login-code/request-login-code.dto.js';
import {
  type ResolvedSession,
  ResolveSessionCommand,
} from './commands/resolve-session/resolve-session.command.js';
import type { ResolveSessionDto } from './commands/resolve-session/resolve-session.dto.js';
import { SetCefrLevelCommand } from './commands/set-cefr-level/set-cefr-level.command.js';
import { SetDailyGoalCommand } from './commands/set-daily-goal/set-daily-goal.command.js';
import { VerifyLoginCodeCommand } from './commands/verify-login-code/verify-login-code.command.js';
import type { VerifyLoginCodeDto } from './commands/verify-login-code/verify-login-code.dto.js';
import type { User } from './entities/user.entity.js';
import { GetAccountDeletionQuery } from './queries/get-account-deletion/get-account-deletion.query.js';
import { GetUserQuery } from './queries/get-user/get-user.query.js';
import type { AccountDeletionView } from './types/account-deletion-view.type.js';
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

  async setCefrLevel(userId: string, cefrLevel: CefrLevel): Promise<CefrLevel> {
    const result = await this.commandBus.execute(
      new SetCefrLevelCommand(userId, cefrLevel),
    );

    await this.em.flush();

    return result;
  }

  async setDailyGoal(userId: string, dailyGoal: number): Promise<number> {
    const result = await this.commandBus.execute(
      new SetDailyGoalCommand(userId, dailyGoal),
    );

    await this.em.flush();

    return result;
  }

  async requestAccountDeletion(userId: string): Promise<AccountDeletionView> {
    const result = await this.commandBus.execute(
      new RequestAccountDeletionCommand(userId),
    );

    await this.em.flush();

    return result;
  }

  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.commandBus.execute(new CancelAccountDeletionCommand(userId));

    await this.em.flush();
  }

  async cancelAccountDeletionByToken(
    dto: CancelAccountDeletionByTokenDto,
  ): Promise<void> {
    await this.commandBus.execute(new CancelAccountDeletionByTokenCommand(dto));

    await this.em.flush();
  }

  getAccountDeletion(userId: string): Promise<AccountDeletionView | null> {
    return this.queryBus.execute(new GetAccountDeletionQuery(userId));
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
