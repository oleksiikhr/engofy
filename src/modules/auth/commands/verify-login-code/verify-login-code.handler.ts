import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ChallengeService } from '../../services/challenge.service.js';
import { CompleteLoginService } from '../../services/complete-login.service.js';
import type { LoginResult } from '../../types/login-result.type.js';
import { VerifyLoginCodeCommand } from './verify-login-code.command.js';

@CommandHandler(VerifyLoginCodeCommand)
export class VerifyLoginCodeHandler
  implements ICommandHandler<VerifyLoginCodeCommand>
{
  constructor(
    private readonly challenges: ChallengeService,
    private readonly completeLogin: CompleteLoginService,
  ) {}

  async execute(command: VerifyLoginCodeCommand): Promise<LoginResult> {
    const { email } = await this.challenges.consumeByOtp(
      command.dto.email,
      command.dto.code,
    );

    return this.completeLogin.loginByEmail(email);
  }
}
