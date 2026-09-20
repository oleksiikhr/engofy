import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AppConfig from '../../core/config/app.config.js';
import MailConfig from '../../core/mail/mail.config.js';
import { mailerProvider } from '../../core/mail/mailer.provider.js';
import { AuthService } from './auth.service.js';
import { CancelAccountDeletionHandler } from './commands/cancel-account-deletion/cancel-account-deletion.handler.js';
import { CancelAccountDeletionByTokenHandler } from './commands/cancel-account-deletion-by-token/cancel-account-deletion-by-token.handler.js';
import { LoginWithGoogleHandler } from './commands/login-with-google/login-with-google.handler.js';
import { LogoutHandler } from './commands/logout/logout.handler.js';
import { RequestAccountDeletionHandler } from './commands/request-account-deletion/request-account-deletion.handler.js';
import { RequestLoginCodeHandler } from './commands/request-login-code/request-login-code.handler.js';
import { ResolveSessionHandler } from './commands/resolve-session/resolve-session.handler.js';
import { SetCefrLevelHandler } from './commands/set-cefr-level/set-cefr-level.handler.js';
import { SetDailyGoalHandler } from './commands/set-daily-goal/set-daily-goal.handler.js';
import { VerifyLoginCodeHandler } from './commands/verify-login-code/verify-login-code.handler.js';
import AuthConfig from './config/auth.config.js';
import { GetAccountDeletionHandler } from './queries/get-account-deletion/get-account-deletion.handler.js';
import { GetUserHandler } from './queries/get-user/get-user.handler.js';
import { AccountDeletionService } from './services/account-deletion.service.js';
import { AuthQueueBootstrapService } from './services/auth-queue-bootstrap.service.js';
import { ChallengeService } from './services/challenge.service.js';
import { CompleteLoginService } from './services/complete-login.service.js';
import { GoogleIdTokenVerifierService } from './services/google-id-token-verifier.service.js';
import { SessionService } from './services/session.service.js';
import { AccountDeletionMailerService } from './services/shared/account-deletion-mailer.service.js';
import { ChallengeMailerService } from './services/shared/challenge-mailer.service.js';
import { DeleteExpiredAccountsService } from './services/shared/delete-expired-accounts.service.js';

const commandHandlers = [
  CancelAccountDeletionByTokenHandler,
  CancelAccountDeletionHandler,
  LoginWithGoogleHandler,
  LogoutHandler,
  RequestAccountDeletionHandler,
  RequestLoginCodeHandler,
  ResolveSessionHandler,
  SetCefrLevelHandler,
  SetDailyGoalHandler,
  VerifyLoginCodeHandler,
];

const queryHandlers = [GetAccountDeletionHandler, GetUserHandler];

@Module({
  imports: [
    ConfigModule.forFeature(AuthConfig),
    ConfigModule.forFeature(AppConfig),
    ConfigModule.forFeature(MailConfig),
    CqrsModule,
  ],
  providers: [
    AuthService,
    AuthQueueBootstrapService,
    AccountDeletionService,
    ChallengeService,
    SessionService,
    CompleteLoginService,
    GoogleIdTokenVerifierService,
    ChallengeMailerService,
    AccountDeletionMailerService,
    DeleteExpiredAccountsService,
    mailerProvider,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [
    AuthService,
    ChallengeMailerService,
    AccountDeletionMailerService,
    DeleteExpiredAccountsService,
  ],
})
export class AuthModule {}
