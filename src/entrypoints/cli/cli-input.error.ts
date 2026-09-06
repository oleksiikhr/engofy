/**
 * A CLI invocation is malformed in a way the user can fix (a missing input
 * file, an unreadable path). Thrown before any work starts so the failure reads
 * as user error, not an infrastructure fault. Sibling of `InvalidCliFlagError`
 * (which is specific to `--flag` values).
 */
export class CliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = CliInputError.name;
  }
}
