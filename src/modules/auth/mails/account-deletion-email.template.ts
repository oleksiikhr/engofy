import type { RenderedEmail } from './challenge-email.template.js';

export interface AccountDeletionEmailInput {
  cancelUrl: string;
  scheduledFor: string;
}

export function renderAccountDeletionEmail(
  input: AccountDeletionEmailInput,
): RenderedEmail {
  const { cancelUrl, scheduledFor } = input;

  const subject = 'Your Engofy account is scheduled for deletion';
  const text = `We received a request to delete your Engofy account. It will be permanently deleted on ${scheduledFor}. If this wasn't you, or you changed your mind, cancel it here: ${cancelUrl}`;
  const html = `<p>We received a request to delete your Engofy account. It will be permanently deleted on <strong>${scheduledFor}</strong>.</p><p>If this wasn't you, or you changed your mind, <a href="${cancelUrl}">cancel the deletion</a>.</p>`;

  return { subject, text, html };
}
