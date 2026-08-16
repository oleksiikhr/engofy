export interface ChallengeEmailInput {
  otp: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderChallengeEmail(
  input: ChallengeEmailInput,
): RenderedEmail {
  const { otp } = input;

  const subject = 'Your Engofy sign-in code';
  const text = `Your sign-in code is: ${otp}`;
  const html = `<p>Your sign-in code is <strong>${otp}</strong></p>`;

  return { subject, text, html };
}
