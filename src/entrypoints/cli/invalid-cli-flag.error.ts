export class InvalidCliFlagError extends Error {
  constructor(readonly flag: string) {
    super('CLI flag contains no valid entries');
    this.name = InvalidCliFlagError.name;
  }
}
