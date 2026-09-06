// The Telegram Bot API returned a response we did receive but it rejected the
// call — an HTTP error status, or HTTP 200 with `ok: false`. Carries the HTTP
// status, the API `description`, and (for `429` rate limits) the `retry_after`
// hint in seconds so a caller can tell "slow down" apart from a hard failure.
//
// A transport failure (fetch itself rejected — DNS, connection reset, timeout)
// stays a plain `Error` with a structured `cause` (error-handling.md E4); this
// class is only for a reply the API sent back.
export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string | null,
    readonly retryAfter: number | null,
  ) {
    super(
      `telegram ${method} responded ${status}: ${description ?? '(no body)'}` +
        (retryAfter !== null ? ` (retry_after=${retryAfter}s)` : ''),
    );
    this.name = new.target.name;
  }

  // Telegram is asking us to back off rather than reporting a broken request.
  get isRateLimited(): boolean {
    return this.status === 429 || this.retryAfter !== null;
  }
}
