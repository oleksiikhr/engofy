// The model returned a tool payload that does not match the tool's schema
// (not a max_tokens truncation — that has its own distinct error). Thrown
// instead of the raw `ZodError` from `tool.schema.parse` so a worker /
// Sentry can tell "the model gave a bad shape, a pg-boss retry will likely
// fix it" from a real bug in the schema or the calling code. Still `extends
// Error` (never on an HTTP path), and still thrown so pg-boss retries.
//
// `rawInput` is the model's payload serialised and cut to RAW_INPUT_MAX_CHARS,
// so the real shape of a malformed response is visible in logs and Sentry.
export const RAW_INPUT_MAX_CHARS = 2048;

export function truncateRawInput(input: unknown): string {
  let serialised: string | undefined;
  try {
    serialised = JSON.stringify(input);
  } catch {
    serialised = undefined;
  }
  const text = serialised ?? String(input);
  return text.length > RAW_INPUT_MAX_CHARS
    ? `${text.slice(0, RAW_INPUT_MAX_CHARS)}…[truncated ${text.length - RAW_INPUT_MAX_CHARS} chars]`
    : text;
}

export class AiSchemaMismatchError extends Error {
  constructor(
    readonly tool: string,
    options?: { cause?: unknown; rawInput?: string },
  ) {
    super(
      `AI tool "${tool}" returned a payload that failed schema validation`,
      {
        cause: options?.cause,
      },
    );
    this.name = new.target.name;
    this.rawInput = options?.rawInput;
  }

  readonly rawInput?: string;
}
