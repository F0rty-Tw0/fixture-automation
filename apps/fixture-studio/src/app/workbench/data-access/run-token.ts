import { linkedSignal, untracked } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

const freshToken = (): symbol => Symbol('run');

/**
 * Which async run is current: `renew()` or a change of `source` starts a new one. A result that lands for an earlier run
 * is dropped, even when it lands before a resource notices the change and while its abort signal is not set yet.
 */
export class RunToken {
  private readonly token: WritableSignal<symbol>;

  public constructor(source: Signal<unknown>) {
    this.token = linkedSignal({ source, computation: freshToken });
  }

  public renew(): void {
    this.token.set(freshToken());
  }

  /** Runs `load` and hands its result to `keep` only if its run is still the current one when it lands. */
  public async keepIfCurrent<TValue>(load: () => Promise<TValue>, keep: (value: TValue) => void): Promise<TValue> {
    const started = untracked(this.token);
    const value = await load();
    const current = untracked(this.token);

    if (started === current) keep(value);

    return value;
  }
}
