/**
 * A missing-field fill whose answers stayed unusable after the repair round. `candidates` holds every answer that
 * parsed as JSON, in attempt order, so a caller can still salvage values from them; `problem` says what was wrong.
 */
export class AiFillRejectedError extends Error {
  public override readonly name = 'AiFillRejectedError';
  public readonly candidates: unknown[];
  public readonly problem: string;

  public constructor(message: string, candidates: unknown[], problem: string, options?: ErrorOptions) {
    super(message, options);
    this.candidates = candidates;
    this.problem = problem;
  }
}
