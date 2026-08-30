import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AppConfig from '../../core/config/app.config.js';
import MailConfig from '../../core/mail/mail.config.js';
import { mailerProvider } from '../../core/mail/mailer.provider.js';
import { AuthService } from './auth.service.js';
import { LoginWithGoogleHandler } from './commands/login-with-google/login-with-google.handler.js';
import { LogoutHandler } from './commands/logout/logout.handler.js';
import { RequestLoginCodeHandler } from './commands/request-login-code/request-login-code.handler.js';
import { ResolveSessionHandler } from './commands/resolve-session/resolve-session.handler.js';
import { VerifyLoginCodeHandler } from './commands/verify-login-code/verify-login-code.handler.js';
import AuthConfig from './config/auth.config.js';
import { GetUserHandler } from './queries/get-user/get-user.handler.js';
import { ChallengeService } from './services/challenge.service.js';
import { CompleteLoginService } from './services/complete-login.service.js';
import { GoogleIdTokenVerifierService } from './services/google-id-token-verifier.service.js';
import { SessionService } from './services/session.service.js';
import { ChallengeMailerService } from './services/shared/challenge-mailer.service.js';

const commandHandlers = [
  LoginWithGoogleHandler,
  LogoutHandler,
  RequestLoginCodeHandler,
  ResolveSessionHandler,
  VerifyLoginCodeHandler,
];

const queryHandlers = [GetUserHandler];

@Module({
  imports: [
    ConfigModule.forFeature(AuthConfig),
    ConfigModule.forFeature(AppConfig),
    ConfigModule.forFeature(MailConfig),
    CqrsModule,
  ],
  providers: [
    AuthService,
    ChallengeService,
    SessionService,
    CompleteLoginService,
    GoogleIdTokenVerifierService,
    ChallengeMailerService,
    mailerProvider,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [AuthService, ChallengeMailerService],
})
export class AuthModule {}
