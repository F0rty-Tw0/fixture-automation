import { statusError } from '../../shared/http/utils/status-error.util.ts';

/** One cap for the whole server, shared by model discovery and fills of every tool. */
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
