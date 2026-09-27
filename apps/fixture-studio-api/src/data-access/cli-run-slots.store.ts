import { statusError } from '../utils/status-error.util.ts';

// ponytail: one global cap of 2 concurrent CLI runs per server (model discovery and fills alike); queue or cap per tool when users need more.
const CLI_RUN_LIMIT = 2;

/** Counts running AI CLI processes; a claim beyond `CLI_RUN_LIMIT` fails with a 429. */
export class CliRunSlots {
  private running = 0;

  public claim(): void {
    const isFull = this.running >= CLI_RUN_LIMIT;

    if (isFull) throw statusError(429, 'too many AI CLI runs at once', 'wait for a running fill or model lookup to finish');

    this.running += 1;
  }

  public release(): void {
    this.running -= 1;
  }
}
