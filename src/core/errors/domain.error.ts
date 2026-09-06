export class DomainError extends Error {
  /**
   * HTTP status `DomainErrorFilter` responds with. Defaults to 400; subclasses
   * raise it for 404 (`*NotFound`), 409 (unique conflict) or 429 (`TooMany*`).
   * Only consulted on the HTTP path — pipeline handlers throw the same errors
   * in workers where the status is inert.
   */
  constructor(
    message?: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
