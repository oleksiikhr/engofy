import { Command } from '@nestjs/cqrs';
import type { LoginResult } from '../../types/login-result.type.js';
import type { LoginWithGoogleDto } from './login-with-google.dto.js';

export class LoginWithGoogleCommand extends Command<LoginResult> {
  constructor(readonly dto: LoginWithGoogleDto) {
    super();
  }
}
