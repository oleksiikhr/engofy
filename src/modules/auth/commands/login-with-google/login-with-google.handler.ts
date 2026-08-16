import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CompleteLoginService } from '../../services/complete-login.service.js';
import { GoogleIdTokenVerifierService } from '../../services/google-id-token-verifier.service.js';
import type { LoginResult } from '../../types/login-result.type.js';
import { LoginWithGoogleCommand } from './login-with-google.command.js';

@CommandHandler(LoginWithGoogleCommand)
export class LoginWithGoogleHandler
  implements ICommandHandler<LoginWithGoogleCommand>
{
  constructor(
    private readonly googleVerifier: GoogleIdTokenVerifierService,
    private readonly completeLogin: CompleteLoginService,
  ) {}

  async execute(command: LoginWithGoogleCommand): Promise<LoginResult> {
    const identity = await this.googleVerifier.verify(command.dto.credential);

    return this.completeLogin.loginByGoogle(identity.email, identity.googleSub);
  }
}
