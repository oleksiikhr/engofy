import { AuthorizationError } from '../../../core/errors/authorization.error.js';

// A Free/guest actor hit a Premium-only route (`BillingService.assertPremium`).
export class PremiumRequiredError extends AuthorizationError {
  constructor() {
    super('This feature requires a Premium subscription.');
  }
}
