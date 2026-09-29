/** A failure the user can act on: `message` says what broke, `fix` says what to do instead. */
export class FixtureError extends Error {
  public override readonly name = 'FixtureError';
  public readonly fix: string | undefined;

  public constructor(message: string, fix?: string) {
    super(message);

    this.fix = fix;
  }
}
