// The model returned a tool payload that does not match the tool's schema
// (not a max_tokens truncation — that has its own distinct error). Thrown
// instead of the raw `ZodError` from `tool.schema.parse` so a worker /
// Sentry can tell "the model gave a bad shape, a pg-boss retry will likely
// fix it" from a real bug in the schema or the calling code. Still `extends
// Error` (never on an HTTP path), and still thrown so pg-boss retries.
export class AiSchemaMismatchError extends Error {
  constructor(
    readonly tool: string,
    options?: { cause?: unknown },
  ) {
    super(
      `AI tool "${tool}" returned a payload that failed schema validation`,
      {
        cause: options?.cause,
      },
    );
    this.name = new.target.name;
  }
}
