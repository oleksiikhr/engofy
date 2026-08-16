import { Command } from '@nestjs/cqrs';
import type { LoginResult } from '../../types/login-result.type.js';
import type { VerifyLoginCodeDto } from './verify-login-code.dto.js';

export class VerifyLoginCodeCommand extends Command<LoginResult> {
  constructor(readonly dto: VerifyLoginCodeDto) {
    super();
  }
}
